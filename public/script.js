// script.js

let serverUrl = "http://localhost:3000";
//let serverUrl =  "https://dc64-171-251-212-27.ngrok-free.app";
let sortAsc = true;
let registrationData = [];
let excelData = [];

//LOGIN
async function loginAdmin(e) {
e.preventDefault();
const username = document.getElementById("username").value;
const password = document.getElementById("password").value;

const res = await fetch(`${serverUrl}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
});

const data = await res.json();
if (data.success) {
    localStorage.setItem("admin_token", data.token);
    window.location.href = "/admin.html";
} else {
    document.getElementById("error-msg").textContent = data.message || "Đăng nhập thất bại!";
}
}

//ADMIN
function handleAuthError(response) {
  if (response.status === 403) {
    Swal.fire("Lỗi", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", "error");
    localStorage.removeItem("admin_token");
    window.location.href = "/login.html";
    return true;
  }
  return false;
}


function toggleSortByMa() {
    sortAsc = !sortAsc;
    fetchRegistrations(true); 
}

function saveQRCode() {
    const canvas = document.getElementById("qr-canvas");
    const ten = document.getElementById("qr-name")?.textContent?.trim().replace(/\s+/g, "_") || "unknown";
    const cccd = document.getElementById("qr-cccd")?.textContent?.trim() || "unknown";
    const now = new Date();
    const formattedTime = now.toLocaleString("vi-VN", {
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).replace(/[^\d]/g, "_");
  
    const filename = `qrcode_${ten}_${cccd}_${formattedTime}.png`;
  
    const link = document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }
  

function getTodayStr() {
  const today = new Date();
  return today.toISOString().slice(0, 10);
}

function toDatetimeLocalFormat(dateInput) {
const d = new Date(dateInput);
const offsetMs = d.getTimezoneOffset() * 60000;
const local = new Date(d.getTime() - offsetMs);
return local.toISOString().slice(0, 16); // yyyy-MM-ddTHH:mm
}

function showTab(tabId) {
  // 1. Ẩn toàn bộ nội dung các tab
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.getElementById(tabId).classList.remove('hidden');

  // 2. Xóa class `active` khỏi tất cả nút sidebar
  document.querySelectorAll('.sidebar-button').forEach(btn => btn.classList.remove('active'));

  // 3. Đánh dấu nút đang được click là active
  const tabToText = {
      'tab-dangky': 'Đăng ký làm việc',
      'tab-baocao': 'Báo cáo',
      'tab-thongke': 'Thống kê',
      'tab-settings': 'Settings',
      'tab-logout': 'Logout'
  };

  document.querySelectorAll('.sidebar-button').forEach(btn => {
      if (btn.textContent.trim() === tabToText[tabId]) {
          btn.classList.add('active');
      }
  });

  // 4. Gọi các hàm xử lý riêng nếu cần
  if (tabId === "tab-baocao") loadHistory();
  if (tabId === "tab-thongke") fetchStats();
}


async function fetchRegistrations(skipFetch = false) {
    if (!skipFetch) {
      const res = await fetch(`${serverUrl}/api/all`, {
        headers: {
          'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
        }
      });
      if (handleAuthError(res)) return;
      registrationData = await res.json();
    }
  
    // Sắp xếp theo Ma nếu đang bật sorting
    registrationData.sort((a, b) => {
      const maA = isNaN(a.Ma) ? a.Ma : Number(a.Ma);
      const maB = isNaN(b.Ma) ? b.Ma : Number(b.Ma);
      return sortAsc ? maA > maB ? 1 : -1 : maA < maB ? 1 : -1;
    });
  
    const tbody = document.getElementById('reg-body');
    tbody.innerHTML = '';
    registrationData.forEach(row => {
      const hetHanInputId = `hethan-${row.Ma}`;
      tbody.innerHTML += `
        <tr class="border-b">
          <td class="p-2">${row.Ma}</td>
          <td class="p-2">${row.HoTen}</td>
          <td class="p-2">${row.CCCD_HoChieu}</td>
          <td class="p-2">${row.CongTy}</td>
          <td class="p-2">${row.NoiDungLV}</td>
          <td class="p-2">
            <input id="${hetHanInputId}" type="datetime-local" class="border rounded p-1 text-sm" value="${toDatetimeLocalFormat(row.HetHan)}">
          </td>
          <td class="p-2 flex gap-2">
            <button class="bg-yellow-400 text-white px-2 py-1 rounded" onclick='editRow(${JSON.stringify(row)})'>Sửa</button>
            <button class="bg-red-500 text-white px-2 py-1 rounded" onclick='deleteRow("${row.Ma}")'>Xóa</button>
            <button class="bg-green-500 text-white px-2 py-1 rounded" onclick='setExpiryAndGenerateQR("${row.Ma}", "${hetHanInputId}", "${row.HoTen}", "${row.CCCD_HoChieu || ''}")'>Tạo QR</button>
          </td>
        </tr>
      `;
    });
}
  
function deleteRow(ma) {
  Swal.fire({
    title: 'Xác nhận xóa?',
    text: `Bạn có chắc muốn xóa mã "${ma}" không?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Xóa',
    cancelButtonText: 'Hủy',
    confirmButtonColor: '#e3342f'
  }).then((result) => {
    if (result.isConfirmed) {
      fetch(`${serverUrl}/api/delete/${ma}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
        }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            Swal.fire('Đã xóa!', 'Dữ liệu đã được xóa thành công.', 'success');
            fetchRegistrations();
          } else {
            Swal.fire('Lỗi!', 'Không thể xóa dữ liệu.', 'error');
          }
        })
        .catch(err => {
          console.error('Lỗi xóa:', err);
          Swal.fire('Lỗi!', 'Đã xảy ra lỗi khi xóa.', 'error');
        });
    }
  });
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

function saveForm() {
  Swal.fire({
    title: 'Xác nhận lưu?',
    text: 'Bạn có chắc muốn lưu thông tin này không?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Lưu',
    cancelButtonText: 'Hủy'
  }).then((result) => {
    if (result.isConfirmed) {
      const form = document.forms['reg-form'];
      const body = {
        Ma: form.Ma.value,
        NgayTao: form.NgayTao.value,
        HoTen: form.HoTen.value,
        SoDienThoai: form.SoDienThoai.value,
        CCCD_HoChieu: form.CCCD_HoChieu.value,
        ChucVu: form.ChucVu.value,
        CongTy: form.CongTy.value,
        BienSoXe: form.BienSoXe.value,
        NoiDungLV: form.NoiDungLV.value
      };

      fetch(`${serverUrl}/api/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
        },
        body: JSON.stringify(body)
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            Swal.fire('Thành công!', 'Thông tin đã được lưu.', 'success');
            fetchRegistrations();
          } else {
            Swal.fire('Lỗi!', 'Không thể lưu dữ liệu.', 'error');
          }
        })
        .catch(err => {
          console.error('Lỗi khi lưu:', err);
          Swal.fire('Lỗi!', 'Đã xảy ra lỗi khi gửi dữ liệu.', 'error');
        });
    }
  });
}


function setExpiryAndGenerateQR(ma, inputId, hoTen, cccd = '') {
    const datetimeStr = document.getElementById(inputId).value;
    if (!datetimeStr) return Swal.fire("Thiếu thông tin", "Vui lòng chọn thời gian hết hạn", "warning");
  
    const localDate = new Date(datetimeStr);
    const offsetMs = localDate.getTimezoneOffset() * 60000;
    const timestamp = localDate.getTime() - offsetMs;
    const token = localStorage.getItem("admin_token");
  
    fetch(`${serverUrl}/api/set-expiry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ Ma: ma, HetHan: timestamp })
    })
    .then(res => res.ok ? res.json() : Promise.reject("Lỗi cập nhật"))
    .then(() => {
      const popup = document.getElementById("qr-popup");
      const canvas = document.getElementById("qr-canvas");
      const infoDiv = document.getElementById("qr-info");
      
      // Set thông tin người dùng
      infoDiv.innerHTML = `
        <div class="uppercase font-bold text-base" id ="qr-name">${hoTen}</div>
        ${cccd ? `<div class="text-gray-700" id ="qr-cccd">${cccd}</div>` : ""}
      `;
  
      // Xoá QR cũ
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, canvas.width, canvas.height);
  
      QRCode.toCanvas(canvas, ma, { width: 200 }, function(error) {
        if (!error) popup.classList.remove("hidden");
        else console.error("QR error:", error);
      });
    })
    .catch(err => {
       Swal.fire("Lỗi", err.message || "Lỗi không xác định", "error");
    });
}

function importExcel() {
  const fileInput = document.getElementById("excel-file");
  const file = fileInput.files[0];
  if (!file) return Swal.fire("Lỗi", "Vui lòng chọn file Excel!", "warning");

  Swal.fire({
    title: "Xác nhận tải lên?",
    text: "Bạn có chắc chắn muốn nhập dữ liệu từ file này không?",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Tải lên",
    cancelButtonText: "Hủy",
    confirmButtonColor: "#3085d6",
    cancelButtonColor: "#d33"
  }).then((result) => {
    if (!result.isConfirmed) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const excelData = XLSX.utils.sheet_to_json(sheet).map((row, index) => ({
        Ma: String(row["STT"] || index + 1),
        HoTen: String(row["Họ và tên"] || ""),
        ChucVu: String(row["Chức vụ"] || ""),
        CongTy: String(row["Công ty"] || ""),
        CCCD_HoChieu: String(row["Số CCCD"] || ""),
        SoDienThoai: String(row["Số điện thoại"] || ""),
        BienSoXe: String(row["Biển số xe"] || ""),
        NoiDungLV: String(row["Nhiệm vụ trong Cảng"] || ""),
        NgayTao: new Date(),
        HetHan: null
      }));

      if (excelData.length === 0) return Swal.fire("Lỗi", "Không có dữ liệu!", "error");

      fetch(`${serverUrl}/api/import-excel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ rows: excelData })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            Swal.fire("Thành công", "Nhập dữ liệu thành công!", "success")
              .then(() => location.reload());
          } else {
            Swal.fire("Lỗi", "Không thể nhập dữ liệu!", "error");
          }
        })
        .catch(err => {
          console.error("Lỗi:", err);
          Swal.fire("Lỗi", "Lỗi khi gửi dữ liệu!", "error");
        });
    };

    reader.readAsArrayBuffer(file);
  });
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
                Swal.fire("Thành công", "Cập nhật thành công!", "success");
                document.getElementById("check-btn").classList.add("hidden");
                onScanSuccess(ma); 
            } else {
                Swal.fire("Lỗi", "Cập nhật thất bại!", "error");
            }
        })
        .catch(err => {
            console.error("Lỗi cập nhật:", err);
            Swal.fire("Lỗi", "Có lỗi xảy ra khi cập nhật.", "error");
        });
}

//Setting
function saveServerUrl() {
const url = document.getElementById("server-url").value.trim();
if (!url) return alert("Vui lòng nhập URL server");

// Lưu vào localStorage và cập nhật biến toàn cục
localStorage.setItem("server_url", url);
if (typeof serverUrl !== "undefined") {
    serverUrl = url;
}
alert("Đã cập nhật URL server!");
}

window.addEventListener("DOMContentLoaded", () => {
const savedUrl = localStorage.getItem("server_url");
if (savedUrl) document.getElementById("server-url").value = savedUrl;
});

//TAB BÁO CÁO
let historyData = [];
let pageSize = 10;
let currentPage = 1;

function changePageSize() {
    pageSize = parseInt(document.getElementById("page-size").value);
    currentPage = 1;
    renderHistoryPage();
}

function formatVietnamTime(isoString) {
  const localIso = isoString.replace(/Z$/, '');
  return new Date(localIso).toLocaleString("vi-VN", { hour12: false });
}

async function exportFromTemplate(data) {
  const response = await fetch('/template.xlsx'); // Đường dẫn tới file mẫu
  const buffer = await response.arrayBuffer();

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.getWorksheet('Nhân lực'); // Hoặc sheet name

  let startRow = 8; // Bắt đầu từ dòng 8 theo yêu cầu của bạn

  data.forEach((item, index) => {
    const row = sheet.getRow(startRow + index);
    row.getCell(1).value = item.Ma;
    row.getCell(2).value = item.HoTen;
    row.getCell(3).value = item.ChucVu;
    row.getCell(4).value = item.CongTy;
    row.getCell(5).value = item.CCCD_HoChieu;
    row.getCell(6).value = item.SoDienThoai;
    row.getCell(7).value = item.BienSoXe;
    row.getCell(8).value = item.NoiDungLV;
    row.getCell(9).value = item.BangCap || "";
    row.getCell(10).value = item.Note || "";
    row.getCell(11).value = item.Status || "";
    row.getCell(12).value = item.Type_Customer || "";
    row.getCell(13).value = formatVietnamTime(item.ThoiGian);
    row.getCell(14).value = formatVietnamTime(item.NgayTao);
    row.getCell(15).value = formatVietnamTime(item.HetHan);

    row.commit();
  });

  const blob = await workbook.xlsx.writeBuffer();
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([blob]));
  link.download = `BaoCaoQR_${Date.now()}.xlsx`;
  link.click();
}

async function handleExportExcel() {
  try {
    const res = await fetch(`${serverUrl}/api/export-history-full`, {
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
      }
    });
    if (handleAuthError(res)) return;
    const data = await res.json();

    // Lấy giá trị bộ lọc
    const bienSo = document.getElementById("filter-biensoxe").value.toLowerCase();
    const type = document.getElementById("filter-type").value;
    const status = document.getElementById("filter-status").value;
    const from = document.getElementById("filter-from").value;
    const to = document.getElementById("filter-to").value;

    const filteredData = data.filter(item => {
      const time = new Date(item.ThoiGian);
      const fromTime = from ? new Date(from + 'T00:00:00') : null;
      const toTime = to ? new Date(to + 'T23:59:59') : null;

      return (!bienSo || (item.BienSoXe || "").toLowerCase().includes(bienSo)) &&
             (!type || item.Type_Customer === type) &&
             (!status || item.Status === status) &&
             (!fromTime || time >= fromTime) &&
             (!toTime || time <= toTime);
    });

    exportFromTemplate(filteredData);
  } catch (err) {
    console.error("Lỗi xuất Excel:", err);
    Swal.fire("Lỗi", "Không thể xuất file Excel.", "error");
  }
}
  
function filterHistory() {
  const bienSoFilter = document.getElementById("filter-biensoxe").value.toLowerCase();
  //const typeFilter = document.getElementById("filter-type").value;
  const statusFilter = document.getElementById("filter-status").value;
  const fromDate = document.getElementById("filter-from").value;
  const toDate = document.getElementById("filter-to").value;

  return historyData.filter(row => {
    if (bienSoFilter && !(row.BienSoXe || "").toLowerCase().includes(bienSoFilter)) return false;
    // if (typeFilter && row.Type_Customer !== typeFilter) return false;
    if (statusFilter && row.Status !== statusFilter) return false;

    if (fromDate || toDate) {
      const rowTime = new Date(row.ThoiGian);
      const rowDate = rowTime.toISOString().split('T')[0]; // Lấy YYYY-MM-DD

      if (fromDate) {
        const startDate = new Date(fromDate).toISOString().split('T')[0];
        if (rowDate < startDate) return false;
      }
      if (toDate) {
        const endDate = new Date(toDate).toISOString().split('T')[0];
        if (rowDate > endDate) return false;
      }
    }

    return true;
  });
}

function renderHistoryPage() {
    const tbody = document.getElementById("history-body");
    tbody.innerHTML = "";
  
    const filtered = filterHistory(); 
  
    const totalPages = Math.ceil(filtered.length / pageSize);
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageData = filtered.slice(start, end);
    if (pageData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-gray-500">Không có dữ liệu phù hợp.</td></tr>`;
    }
    pageData.forEach(row => {
      const time = formatVietnamTime(row.ThoiGian);
      tbody.innerHTML += `
        <tr class="border-b">
          <td class="p-2">${row.Id}</td>
          <td class="p-2">${row.HoTen}</td>
          <td class="p-2">${row.BienSoXe || ""}</td>
          <td class="p-2">${row.CongTy}</td>
          <td class="p-2">${row.Status}</td>
          <td class="p-2">${time}</td>
        </tr>
      `;
    });
  
    document.getElementById("page-info").textContent = `Trang ${currentPage} / ${totalPages}`;
    document.getElementById("prev-page").disabled = currentPage === 1;
    document.getElementById("next-page").disabled = currentPage === totalPages;
  }
  

async function loadHistory() {
    const token = localStorage.getItem("admin_token");
  
    const res = await fetch(`${serverUrl}/api/history`, {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });
  
    if (res.ok) {
      historyData = await res.json();
      currentPage = 1;
      renderHistoryPage();
    } else {
      Swal.fire("Lỗi", "Không thể tải lịch sử. Hãy đăng nhập lại.", "error");
    }
}

document.getElementById("prev-page").onclick = () => {
  currentPage--;
  renderHistoryPage();
};
document.getElementById("next-page").onclick = () => {
  currentPage++;
  renderHistoryPage();
};

// Gắn sự kiện lọc
["filter-biensoxe", "filter-status", "filter-from", "filter-to"].forEach(id => {
  document.getElementById(id).addEventListener("input", () => {
    currentPage = 1;
    renderHistoryPage();
  });
});

//TAB THỐNG KÊ
async function fetchStats() {
  const from = document.getElementById("stat-from").value;
  const to = document.getElementById("stat-to").value;
  const token = localStorage.getItem("admin_token");

  const res = await fetch(`${serverUrl}/api/history`, {
    headers: {
      'Authorization': 'Bearer ' + token
    }
  });

  if (!res.ok) {
    Swal.fire("Lỗi", "Không thể tải dữ liệu thống kê", "error");
    return;
  }

  const data = await res.json();

  const filtered = data.filter(row => {
    const time = new Date(row.ThoiGian);
    const rowDate = time.toISOString().split('T')[0]; // Lấy YYYY-MM-DD

    if (from && rowDate < from) return false;
    if (to && rowDate > to) return false;
    return true;
  });

  const countIn = filtered.filter(r => r.Status === "Check_in").length;
  const countOut = filtered.filter(r => r.Status === "Check_out").length;

  document.getElementById("total-in").textContent = countIn;
  document.getElementById("total-out").textContent = countOut;

  drawChart(countIn, countOut);
}
  
function drawChart(inCount, outCount) {
const ctx = document.getElementById("checkin-chart").getContext("2d");
if (window.statChart) window.statChart.destroy();

window.statChart = new Chart(ctx, {
    type: "bar",
    data: {
    labels: ["Check In", "Check Out"],
    datasets: [{
        label: "Lượt ghi nhận",
        data: [inCount, outCount],
        backgroundColor: ["#4ade80", "#60a5fa"]
    }]
    },
    options: {
    responsive: true,
    scales: { y: { beginAtZero: true } }
    }
});
}

//LOG OUT
function logoutAdmin() {
  Swal.fire({
    title: "Đăng xuất?",
    text: "Bạn có chắc chắn muốn đăng xuất không?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#3085d6",
    cancelButtonColor: "#d33",
    confirmButtonText: "Đăng xuất",
    cancelButtonText: "Hủy"
  }).then((result) => {
    if (result.isConfirmed) {
      localStorage.removeItem("admin_token");
      window.location.href = "/login.html";
    }
  });
}
