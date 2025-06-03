$(document).ready(function () {
  const Params = new URLSearchParams(window.location.search);
  const policy_ID = Params.get('file') || 'default.docx';

  if (!policy_ID) {
    $('#response').addClass('error').text("No policy ID provided").show();
    return;
  }

  // Fetch departments
  $.get('/getDepartments', function (departments) {
    const select = $('#department_ID');
    departments.forEach(dept => {
      select.append(`<option value="${dept.department_ID}">${dept.department_name}</option>`);
    });
  });

  // Fetch existing policy data
  $.get(`/policy/${policy_ID}`, function (data) {
    $('#policy_ID').val(data.policy_ID);
    $('#policy_name').val(data.policy_name);
    $('#department_ID').val(data.department_ID);
    $('#published_by').val(data.published_by);
    $('#modified_by').val(data.modified_by || '');
    $('#file_format').val(data.file_format);
  }).fail(() => {
    $('#response').addClass('error').text("Failed to load policy data").show();
  });

  // Handle form submission
  $('#editPolicyForm').on('submit', function (e) {
    e.preventDefault();

    const formData = new FormData(this);
    const fileInput = $('#policyFile')[0].files[0];
    const selectedFormat = $('#file_format').val().toLowerCase();

    if (fileInput) {
      const ext = '.' + fileInput.name.split('.').pop().toLowerCase();
      if (ext !== selectedFormat) {
        $('#response').addClass('error').text("File format does not match selected format").show();
        return;
      }
    }

    $.ajax({
      url: '/policy/update',
      method: 'POST',
      data: formData,
      processData: false,
      contentType: false,
      success: function (data) {
        $('#response').removeClass('error').addClass('success').text("Policy updated successfully").show();
      },
      error: function (xhr) {
        const msg = xhr.responseJSON?.error || "Error updating policy";
        $('#response').removeClass('success').addClass('error').text(msg).show();
      }
    });
  });
});
