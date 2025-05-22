async function loginUser() {
  const staffId = document.getElementById('staffId').value;
  const password = document.getElementById('password').value;

  const response = await fetch('http://localhost:3000/login', {  // Correct backend URL
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ staffId, password })
  });

  const data = await response.json();

  if (response.ok) {
    // Store the JWT token in localStorage
    localStorage.setItem('token', data.token);

    // Decode the JWT token to get user information (role_ID)
    const decodedToken = JSON.parse(atob(data.token.split('.')[1])); // Decode the JWT to get the payload
    console.log('Decoded Token:', decodedToken);  // Log the decoded token for inspection

    const role_ID = decodedToken.role_ID; // Get the role_ID from the decoded token

    // Check if role_ID is correct
    console.log('Role ID:', role_ID);  // Check role_ID value

    // Redirect based on the role_ID
    if (role_ID === 1) {  // If role_ID is 1, redirect to Admin Dashboard
      window.location.href = '/admin_dashboard.html';  // Redirect to Admin Dashboard
    } else if (role_ID === 2) {  // If role_ID is 2, redirect to User Dashboard
      window.location.href = '/editor_dashboard.html';   // Redirect to User Dashboard
    } else if (role_ID === 3) {
      window.location.href = '/user_dashboard.html';   // Redirect to User Dashboard
    } else {
      alert('Invalid role ID');  // In case the role ID is unknown
    }
  } else {
    alert(data.message);  // Display error message if login fails
  }
}

// Event listener for form submission
document.getElementById('loginForm').addEventListener('submit', (e) => {
  e.preventDefault();  // Prevent form from reloading the page
  loginUser();  // Call the loginUser function when form is submitted
});
