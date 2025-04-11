from flask import Flask, render_template, jsonify, request
from geopy.distance import geodesic
from datetime import datetime
import sqlite3
import os

app = Flask(__name__)


HOSTEL_LOCATION = (21.498221,83.904285) 
ALERT_RADIUS = 10 

def init_db():
    if not os.path.exists('attendance.db'):
        conn = sqlite3.connect('attendance.db')
        c = conn.cursor()
        c.execute('''CREATE TABLE IF NOT EXISTS attendance
                     (id INTEGER PRIMARY KEY AUTOINCREMENT,
                      user_id TEXT,
                      entry_time DATETIME,
                      exit_time DATETIME,
                      duration INTEGER)''')  
        conn.commit()
        conn.close()

init_db()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/check_location/<lat>/<lon>')
def check_location(lat, lon):
    try:
        current_loc = (float(lat), float(lon))
        distance = geodesic(current_loc, HOSTEL_LOCATION).meters
        
        check_attendance(current_loc, distance, request.remote_addr)
        
        return jsonify({
            'distance': distance,
            'is_in_hostel': distance <= ALERT_RADIUS,
            'hostel_location': HOSTEL_LOCATION,
            'current_location': current_loc,
            'status': 'success'
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        })
@app.route('/check_attendance_status')
def check_attendance_status():
    user_id = request.remote_addr
    conn = sqlite3.connect('attendance.db')
    c = conn.cursor()
    
    today = datetime.now().strftime('%Y-%m-%d')
    c.execute("SELECT COUNT(*) FROM attendance WHERE user_id = ? AND date(entry_time) = ?", 
             (user_id, today))
    count = c.fetchone()[0]
    
    conn.close()
    return jsonify({'markedToday': count > 0})

def check_attendance(current_loc, distance, user_id):
    conn = sqlite3.connect('attendance.db')
    c = conn.cursor()
    
    c.execute("SELECT id, entry_time FROM attendance WHERE user_id = ? AND exit_time IS NULL ORDER BY id DESC LIMIT 1", (user_id,))
    record = c.fetchone()
    
    now = datetime.now()
    
    if distance <= ALERT_RADIUS:
        if not record: 
            c.execute("INSERT INTO attendance (user_id, entry_time) VALUES (?, ?)", 
                     (user_id, now))
            conn.commit()
            print(f"Attendance marked for {user_id} at {now}")
    else: 
        if record:
            entry_time = datetime.strptime(record[1], '%Y-%m-%d %H:%M:%S.%f')
            duration = (now - entry_time).total_seconds()
            c.execute("UPDATE attendance SET exit_time = ?, duration = ? WHERE id = ?", 
                     (now, duration, record[0]))
            conn.commit()
            print(f"Exit recorded for {user_id} after {duration} seconds")
    
    conn.close()

@app.route('/attendance_data')
def attendance_data():
    conn = sqlite3.connect('attendance.db')
    c = conn.cursor()
    c.execute("SELECT * FROM attendance ORDER BY entry_time DESC")
    records = c.fetchall()
    conn.close()
    return jsonify([dict(zip(['id', 'user_id', 'entry_time', 'exit_time', 'duration'], row)) for row in records])

if __name__ == '__main__':
    app.run(debug=True)