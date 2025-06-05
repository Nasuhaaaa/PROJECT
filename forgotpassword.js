document.getElementById('resetForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const email = document.getElementById('email').value;
  const newPassword = document.getElementById('newPassword').value;

  const response = await fetch('/reset-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, newPassword }),
  });

  const message = await response.text();
  document.getElementById('message').innerText = message;
});
