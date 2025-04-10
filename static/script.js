let map;
let userMarker;
let hostelMarker;
let updateInterval;
let checkInterval;
let retryCount = 0;
const MAX_RETRIES = 3; 

document.addEventListener('DOMContentLoaded', function() {
    initMap();
    startTracking();
    
    document.getElementById('update-interval').addEventListener('change', function() {
        clearInterval(checkInterval);
        startTracking();
    });
});

function initMap() {
    map = L.map('map-container').setView([20.5937, 78.9629], 5);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
}

function startTracking() {
    const interval = document.getElementById('update-interval').value * 1000;
    
    checkLocation();
    
    checkInterval = setInterval(checkLocation, interval);
}

function checkLocation() {
    navigator.geolocation.getCurrentPosition(
        updateLocation,
        (error) => {
            if (error.code === error.TIMEOUT && retryCount < MAX_RETRIES) {
                retryCount++;
                setTimeout(checkLocation, 2000); 
            } else {
                showError(error);
                retryCount = 0;
            }
        },
        { 
            enableHighAccuracy: true,
            timeout: 10000, 
            maximumAge: 0
        }
    );
}

function updateLocation(position) {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    const accuracy = position.coords.accuracy;
    
    fetch(`/check_location/${lat}/${lon}`)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'error') {
                throw new Error(data.message);
            }
            
            document.getElementById('status').classList.add('d-none');
            document.getElementById('location-data').classList.remove('d-none');
            
            document.getElementById('current-location').textContent = 
                `${data.current_location[0].toFixed(6)}, ${data.current_location[1].toFixed(6)}`;
            document.getElementById('hostel-location').textContent = 
                `${data.hostel_location[0].toFixed(6)}, ${data.hostel_location[1].toFixed(6)}`;
            document.getElementById('distance').textContent = 
                `${data.distance.toFixed(2)} meters`;
            
            const statusElement = document.getElementById('location-status');
            if (data.is_in_hostel) {
                statusElement.innerHTML = '<span class="badge bg-success">Inside Hostel Premises</span>';
            } else {
                statusElement.innerHTML = '<span class="badge bg-danger">Outside Hostel Premises</span>';
                if (!statusElement.dataset.lastStatus || statusElement.dataset.lastStatus === 'inside') {
                    alert(`You're ${data.distance.toFixed(2)} meters away from hostel!`);
                }
            }
            statusElement.dataset.lastStatus = data.is_in_hostel ? 'inside' : 'outside';
            updateMap(data.current_location, data.hostel_location, data.is_in_hostel);
if (data.is_in_hostel) {
    if (!localStorage.getItem('lastAttendanceMarked') || 
        new Date() - new Date(localStorage.getItem('lastAttendanceMarked')) > 24*60*60*1000) {
        
        fetch('/check_attendance_status')
            .then(response => response.json())
            .then(attendanceData => {
                if (!attendanceData.markedToday) {
                    localStorage.setItem('lastAttendanceMarked', new Date());
                    console.log("Attendance marked for today");
                }
            });
    }
}
fetch('/attendance_data')
    .then(response => response.json())
    .then(data => {
        const tableBody = document.getElementById('attendance-data');
        tableBody.innerHTML = '';
        
        data.forEach(record => {
            const row = document.createElement('tr');
            
            const entryTime = new Date(record.entry_time);
            const exitTime = record.exit_time ? new Date(record.exit_time) : null;
            const duration = record.duration ? 
                `${Math.floor(record.duration / 3600)}h ${Math.floor((record.duration % 3600) / 60)}m` : 
                'Still inside';
            
            row.innerHTML = `
                <td>${entryTime.toLocaleString()}</td>
                <td>${exitTime ? exitTime.toLocaleString() : '-'}</td>
                <td>${duration}</td>
            `;
            tableBody.appendChild(row);
        });
        
        document.getElementById('attendance-history').classList.remove('d-none');
    });

        })
        .catch(error => {
            document.getElementById('status').innerHTML = 
                `<div class="alert alert-danger">Error: ${error.message}</div>`;
            console.error('Error:', error);
        });
}

function updateMap(currentLoc, hostelLoc, isInHostel) {
    const bounds = L.latLngBounds([currentLoc, hostelLoc]);
    map.fitBounds(bounds.pad(0.5));
    
    if (userMarker) map.removeLayer(userMarker);
    if (hostelMarker) map.removeLayer(hostelMarker);
    
    userMarker = L.marker(currentLoc, {
        title: "Your Location",
        icon: L.divIcon({
            className: isInHostel ? 'user-marker in-hostel' : 'user-marker out-hostel',
            html: '<i class="fa fa-user"></i>',
            iconSize: [30, 30]
        })
    }).addTo(map).bindPopup("Your current location");
    
    hostelMarker = L.marker(hostelLoc, {
        title: "Hostel Location",
        icon: L.divIcon({
            className: 'hostel-marker',
            html: '<i class="fa fa-home"></i>',
            iconSize: [30, 30]
        })
    }).addTo(map).bindPopup("Hostel location");

    L.polyline([currentLoc, hostelLoc], {
        color: isInHostel ? 'green' : 'red',
        weight: 2,
        dashArray: '5, 5'
    }).addTo(map);
}

function showError(error) {
    const statusElement = document.getElementById('status');
    let message = '';
    
    switch(error.code) {
        case error.PERMISSION_DENIED:
            message = "You denied the request for geolocation.";
            break;
        case error.POSITION_UNAVAILABLE:
            message = "Location information is unavailable.";
            break;
        case error.TIMEOUT:
            message = "The request to get location timed out.";
            break;
        case error.UNKNOWN_ERROR:
            message = "An unknown error occurred.";
            break;
    }
    
    statusElement.innerHTML = `<div class="alert alert-danger">${message}</div>`;
}