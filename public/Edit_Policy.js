// $(document).ready(function () {
//   const Params = new URLSearchParams(window.location.search);
//   const policy_ID = Params.get('id');

//   if (!policy_ID) {
//     $('#response').addClass('error').text("No policy ID provided in URL").show();
//     return;
//   }

//   // Populate departments
//   $.get('/getDepartments', function (departments) {
//     const select = $('#department_ID');
//     departments.forEach(dept => {
//       select.append(`<option value="${dept.department_ID}">${dept.department_name}</option>`);
//     });
//   });

//   // Populate policy data
//   $.get(`/policy/${policy_ID}`, function (data) {
//     $('#policy_ID').val(data.policy_ID);
//     $('#policy_name').val(data.policy_name);
//     $('#department_ID').val(data.department_ID); // ✅ Set selected value!
//     //$('#department_ID').prop('disabled', true);
//     $('#published_by').val(data.published_by);
//     $('#file_format').val(data.file_format.toLowerCase());
//   }).fail(() => {
//     $('#response').addClass('error').text("Failed to load policy data").show();
//   });

//   console.log('policy_ID:', policy_ID);
// console.log('policy_name:', policy_name);
// console.log('department_ID:', department_ID);
// console.log('modified_by:', modified_by);
// console.log('file_format:', file_format);
// console.log('file:', file);
 
//   // Handle submission
//   $('#editPolicyForm').on('submit', function (e) {
//     e.preventDefault();

//     //$('#department_ID').prop('disabled', false); // enable just before FormData
//     const formData = new FormData();
//     formData.append('policy_ID', $('#policy_ID').val());
//     formData.append('policy_name', $('#policy_name').val());
//     formData.append('department_ID', $('#department_ID').val()); // even if disabled
//     formData.append('modified_by', $('#modified_by').val());
//     formData.append('file_format', $('#file_format').val().toLowerCase());

//     //$('#department_ID').prop('disabled', true); // re-disable after

//     //if (!$('#policy_ID').val() || !$('#policy_name').val() || !$('#department_ID').val() || !$('#modified_by').val() || !$('#file_format').val()) {
//     //$('#response').addClass('error').text("Please fill in all required fields").show();
//     //return;
//     //}

//     const fileInput = $('#policyFile')[0].files[0];
//     if (!fileInput) {
//       $('#response').addClass('error').text("Please upload a file").show();
//       return;
//     }
    
//     const selectedFormat = $('#file_format').val().toLowerCase();
//     const ext = '.' + fileInput.name.split('.').pop().toLowerCase();
//     if (ext !== '.' + selectedFormat) {
//       $('#response').addClass('error').text("Uploaded file format does not match selected format").show();
//       return;
//     }

//     formData.append('policyFile', fileInput);

//     //for (const [key, value] of formData.entries()) {
//     //console.log(`${key}: ${value}`);
//     //}

//     fetch('/policy/update', {
//       method: 'POST',
//       body: formData
//     })
//     .then(response => {
//       if (!response.ok) return response.json().then(err => { throw err; });
//       return response.json();
//     })
//     .then(data => {
//       $('#response').removeClass('error').addClass('success').text("Edited policy uploaded successfully").show();
//     })
//     .catch(error => {
//       const msg = error?.error || "Error uploading edited policy";
//       $('#response').removeClass('success').addClass('error').text(msg).show();
//     });
//   });
// });
