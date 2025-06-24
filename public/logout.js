function logout() {
  const token = localStorage.getItem('token');

  if (token) {
    // Inform backend to log the logout action
    fetch('/logout', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    }).catch(err => {
      console.error('Logout audit failed:', err);
    });
  }

  // Clear token and redirect
  localStorage.removeItem('token');
  sessionStorage.clear(); // optional: in case you use session storage too
  window.location.href = '/login.html';
}
