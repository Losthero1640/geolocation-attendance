let map;
let userMarker;
let hostelMarker;
let updateInterval;
let checkInterval;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    startTracking();
    
    // Handle interval changes
    document.getElementById('update-interval').addEventListener('change', function() {
        clearInterval(checkInterval);
        startTracking();
    });
});

// Initialize the map
function initMap() {
    map = L.map('map-container').setView([20.5937, 78.9629], 5); // Default to India view
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
}

// Start tracking location
function startTracking() {
    const interval = document.getElementById('update-interval').value * 1000;
    
    // Initial check
    checkLocation();
    
    // Set up periodic checking
    checkInterval = setInterval(checkLocation, interval);
}

// Check current location
function checkLocation() {
    navigator.geolocation.getCurrentPosition(
        updateLocation,
        showError,
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
}

// Update location information
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
            
            // Update the UI
            document.getElementById('status').classList.add('d-none');
            document.getElementById('location-data').classList.remove('d-none');
            
            document.getElementById('current-location').textContent = 
                `${data.current_location[0].toFixed(6)}, ${data.current_location[1].toFixed(6)}`;
            document.getElementById('hostel-location').textContent = 
                `${data.hostel_location[0].toFixed(6)}, ${data.hostel_location[1].toFixed(6)}`;
            document.getElementById('distance').textContent = 
                `${data.distance.toFixed(2)} meters`;
            
            // Update status
            const statusElement = document.getElementById('location-status');
            if (data.is_in_hostel) {
                statusElement.innerHTML = '<span class="badge bg-success">Inside Hostel Premises</span>';
            } else {
                statusElement.innerHTML = '<span class="badge bg-danger">Outside Hostel Premises</span>';
                // Only alert if this is a new status change
                if (!statusElement.dataset.lastStatus || statusElement.dataset.lastStatus === 'inside') {
                    alert(`You're ${data.distance.toFixed(2)} meters away from hostel!`);
                }
            }
            statusElement.dataset.lastStatus = data.is_in_hostel ? 'inside' : 'outside';
            
            // Update the map
            updateMap(data.current_location, data.hostel_location, data.is_in_hostel);
            // Add this to the updateLocation function, after updating the map
if (data.is_in_hostel) {
    // Check if we need to mark attendance
    if (!localStorage.getItem('lastAttendanceMarked') || 
        new Date() - new Date(localStorage.getItem('lastAttendanceMarked')) > 24*60*60*1000) {
        
        // Additional check with server to prevent duplicate marking
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
// Add to the updateLocation function
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

// Update the map with current and hostel locations
function updateMap(currentLoc, hostelLoc, isInHostel) {
    // Set the view to include both points
    const bounds = L.latLngBounds([currentLoc, hostelLoc]);
    map.fitBounds(bounds.pad(0.5));
    
    // Remove existing markers
    if (userMarker) map.removeLayer(userMarker);
    if (hostelMarker) map.removeLayer(hostelMarker);
    
    // Add new markers
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
    
    // Add line between points
    L.polyline([currentLoc, hostelLoc], {
        color: isInHostel ? 'green' : 'red',
        weight: 2,
        dashArray: '5, 5'
    }).addTo(map);
}

// Handle geolocation errors
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
