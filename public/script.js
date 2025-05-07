// script.js

const serverUrl = "http://localhost:3000"

//ADMIN
function saveQRCode() {
    const canvas = document.getElementById("qr-canvas");
    const link = document.createElement("a");
    link.download = "qr-code.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
}

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
}

async function fetchRegistrations() {
    const res = await fetch(`${serverUrl}/api/all`);
    const data = await res.json();
    const tbody = document.getElementById('reg-body');
    tbody.innerHTML = '';
    data.forEach(row => {
        const hetHanInputId = `hethan-${row.Ma}`;
        tbody.innerHTML += `
        <tr class="border-b">
          <td class="p-2">${row.Ma}</td>
          <td class="p-2">${row.HoTen}</td>
          <td class="p-2">${row.CongTy}</td>
          <td class="p-2">${row.NoiDungLV}</td>
          <td class="p-2">
            <input id="${hetHanInputId}" type="datetime-local" class="border rounded p-1 text-sm" value="${row.HetHan ? new Date(row.HetHan).toISOString().slice(0,16) : ''}">
          </td>
          <td class="p-2 flex gap-2">
            <button class="bg-yellow-400 text-white px-2 py-1 rounded" onclick='editRow(${JSON.stringify(row)})'>Sửa</button>
            <button class="bg-red-500 text-white px-2 py-1 rounded" onclick='deleteRow("${row.Ma}")'>Xóa</button>
            <button class="bg-green-500 text-white px-2 py-1 rounded" onclick='setExpiryAndGenerateQR("${row.Ma}", "${hetHanInputId}")'>Tạo QR</button>
          </td>
        </tr>
      `;
    });
}

async function deleteRow(ma) {
    if (!confirm("Bạn có chắc muốn xóa mục này?")) return;
    const res = await fetch(`${serverUrl}/api/delete/${ma}`, {
        method: 'DELETE'
    });
    if (res.ok) fetchRegistrations();
}

function editRow(data) {
    const form = document.forms['reg-form'];
    for (const key in data) {
        if (form.elements[key]) {
            if (key === "NgayTao" && data[key]) {
                const d = new Date(data[key]);
                const formatted = d.toISOString().slice(0, 10);
                form.elements[key].value = formatted;
            } else {
                form.elements[key].value = data[key];
            }
        }
    }
    form.elements['Ma'].readOnly = true;
}

async function saveForm() {
    const form = document.forms['reg-form'];
    const body = Object.fromEntries(new FormData(form));
    const res = await fetch(`${serverUrl}/api/save`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    if (res.ok) {
        form.reset();
        form.elements['Ma'].readOnly = false;
        fetchRegistrations();
    }
}

async function setExpiryAndGenerateQR(ma, inputId) {
    const datetimeStr = document.getElementById(inputId).value;
    if (!datetimeStr) return alert("Vui lòng chọn thời gian hết hạn");

    const timestamp = new Date(datetimeStr).getTime();
    const res = await fetch(`${serverUrl}/api/set-expiry`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            Ma: ma,
            HetHan: timestamp
        })
    });

    if (res.ok) {
        const popup = document.getElementById("qr-popup");
        const canvas = document.getElementById("qr-canvas");

        if (!canvas) {
            const newCanvas = document.createElement("canvas");
            newCanvas.id = "qr-canvas";
            popup.querySelector(".qr-wrapper").appendChild(newCanvas);
        }

        // Xoá QR cũ nếu có
        const context = canvas.getContext("2d");
        context.clearRect(0, 0, canvas.width, canvas.height);

        QRCode.toCanvas(canvas, ma, {
            width: 200
        }, function(error) {
            if (error) {
                console.error("QR error:", error);
                alert("Lỗi tạo QR");
            } else {
                popup.classList.remove("hidden");
            }
        });
    } else {
        alert("Lỗi khi cập nhật thời gian hết hạn");
    }
}

let excelData = [];

function importExcel() {
    const fileInput = document.getElementById("excel-file");
    const file = fileInput.files[0];
    if (!file) return alert("Vui lòng chọn file Excel!");

    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {
            type: "array"
        });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        excelData = XLSX.utils.sheet_to_json(sheet);

        if (excelData.length === 0) return alert("Không có dữ liệu!");

        // Gửi dữ liệu lên server
        fetch(`${serverUrl}/api/import-excel`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    rows: excelData
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    alert("Nhập dữ liệu thành công!");
                    location.reload();
                } else {
                    alert("Lỗi nhập dữ liệu!");
                }
            })
            .catch(err => {
                console.error("Lỗi:", err);
                alert("Lỗi khi gửi dữ liệu!");
            });
    };
    reader.readAsArrayBuffer(file);
}

//TRANG QR
function closePopup() {
    document.getElementById("popup-notfound").classList.add("hidden");
}

function updateAllInfo(statusValue = null) {
    const ma = document.getElementById("ma").value;
    const bienso = document.getElementById("bienso").value;
    const ndlv = document.getElementById("ndlv").value;
    const type = document.querySelector('input[name="type_customer"]:checked').value;
    const body = {
        Ma: ma,
        BienSoXe: bienso,
        NoiDungLV: ndlv,
        Type_Customer: type,
        Status: statusValue
    };
    fetch(`${serverUrl}/api/update-all`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                alert("Cập nhật thành công!");
                document.getElementById("check-btn").classList.add("hidden");
                onScanSuccess(ma); // Load lại dữ liệu mới nhất
            } else {
                alert("Cập nhật thất bại!");
            }
        })
        .catch(err => {
            console.error("Lỗi cập nhật:", err);
            alert("Có lỗi xảy ra khi cập nhật.");
        });
}
