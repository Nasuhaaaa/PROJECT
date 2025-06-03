async function searchPolicy() {
  const query = document.getElementById('searchQuery').value;
  const resultsList = document.getElementById('searchResults');
  resultsList.innerHTML = 'Searching...';

  try {
    const res = await fetch(`/policy/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    resultsList.innerHTML = '';

    if (!data.length) {
      resultsList.innerHTML = '<li>No results found.</li>';
      return;
    }

    data.forEach(policy => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${policy.policy_name}</strong> -
        <a href="/${policy.file_path}" target="_blank">View File</a> |
        <button onclick="editPolicy(${policy.policy_ID})">Edit</a>`;
      resultsList.appendChild(li);
    });
  } catch (err) {
    console.error('Error:', err);
    resultsList.innerHTML = '<li>Error while searching.</li>';
  }
}

function editPolicy(policyId) {
  window.location.href = `editPolicy.html?id=${policyId}`;
}