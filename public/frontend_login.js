async function loginUser() {
  const staffId = document.getElementById('staffId').value;
  const password = document.getElementById('password').value;
  const errorMsg = document.getElementById('errorMsg');
  errorMsg.textContent = ''; // Clear previous errors

  try {
    const response = await fetch('http://localhost:3000/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId, password }),
    });

    if (response.ok) {
      const data = await response.json();

      // Store the JWT token in localStorage
      localStorage.setItem('token', data.token);

      // Decode the JWT token payload
      const decodedToken = JSON.parse(atob(data.token.split('.')[1]));
      const role_ID = decodedToken.role_ID;

      // Redirect based on role_ID
      if (role_ID === 1) {
        window.location.href = '/admin_dashboard.html';
      } else if (role_ID === 2) {
        window.location.href = '/editor_dashboard.html';
      } else if (role_ID === 3) {
        window.location.href = '/user_dashboard.html';
      } else {
        errorMsg.textContent = 'Invalid role ID.';
      }
    } else {
      const errorText = await response.text();
      errorMsg.textContent = errorText; // Display backend message (e.g., "Incorrect password")
    }
  } catch (err) {
    errorMsg.textContent = 'Network or server error';
    console.error('Login error:', err);
  }
}

// Attach event listener to your form
document.getElementById('loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  loginUser();
});
