async function searchPolicy() {
  const query = document.getElementById('searchQuery').value;
  const resultsTable = document.getElementById('resultsTable');
  const resultsBody = document.getElementById('resultsBody');
  const noResults = document.getElementById('noResults');

  resultsBody.innerHTML = '';
  resultsTable.style.display = 'none';
  noResults.textContent = 'Searching...';

  try {
    const res = await fetch(`/policy/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    noResults.textContent = '';

    if (!data.length) {
      noResults.textContent = 'No results found.';
      return;
    }

    resultsTable.style.display = 'table';

    data.forEach(policy => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${policy.policy_name}</strong></td>
        <td><a href="/${policy.file_path}" target="_blank">View File</a></td>
        <td>
          <button class="action-btn" onclick="location.href='/Edit_Policy.html?policyID=${policy.policy_ID}'">Edit</button>
          <button class="action-btn" onclick="location.href='/disposal.html?policyID=${policy.policy_ID}'">Delete</button>
        </td>
      `;
      resultsBody.appendChild(row);
    });
  } catch (err) {
    console.error('Error:', err);
    noResults.textContent = 'Error while searching.';
  }
}

function editPolicy(policyId) {
  window.location.href = `editPolicy.html?id=${policyId}`;
}