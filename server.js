// index.js
const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 

const config = {
    user: 'thanhtest',
    password: '123456@A',
    server: 'localhost',
    database: 'DangKyQR',
    options: {
      encrypt: false,
      trustServerCertificate: true
    }
  };

const JWT_SECRET = 'thanhdinhbao'; // NÊN lưu trong .env

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Invalid signature' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token không hợp lệ' });
    req.user = user;
    next();
  });
}

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ success: false, message: 'Thiếu thông tin' });

  try {
    await sql.connect(config);
    const result = await sql.query`
      SELECT * FROM [User]
      WHERE Username = ${username} AND [Password] = ${password}
    `;

    if (result.recordset.length === 0)
      return res.status(401).json({ success: false, message: 'Sai tài khoản hoặc mật khẩu' });

    const user = result.recordset[0];
    const token = jwt.sign(
      { id: user.Id, username: user.Username },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    return res.json({ success: true, token });
  } catch (err) {
    console.error('Lỗi đăng nhập:', err);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
});


// ✅ GET all data
app.get('/api/all', verifyToken, async (req, res) => {
  try {
    await sql.connect(config);
    const result = await sql.query`SELECT * FROM ThongTinDangKy ORDER BY NgayTao DESC`;
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ✅ POST add or update
app.post('/api/save', verifyToken, async (req, res) => {
  const {
    Ma, NgayTao, HoTen, SoDienThoai,
    CCCD_HoChieu, ChucVu, CongTy, BienSoXe, NoiDungLV
  } = req.body;

  try {
    await sql.connect(config);
    const check = await sql.query`SELECT 1 FROM ThongTinDangKy WHERE Ma = ${Ma}`;
    if (check.recordset.length > 0) {
      await sql.query`
        UPDATE ThongTinDangKy
        SET NgayTao=${NgayTao}, HoTen=${HoTen}, SoDienThoai=${SoDienThoai},
            CCCD_HoChieu=${CCCD_HoChieu}, ChucVu=${ChucVu},
            CongTy=${CongTy}, BienSoXe=${BienSoXe}, NoiDungLV=${NoiDungLV}
        WHERE Ma=${Ma}`;
    } else {
      await sql.query`
        INSERT INTO ThongTinDangKy
        (Ma, NgayTao, HoTen, SoDienThoai, CCCD_HoChieu, ChucVu, CongTy, BienSoXe, NoiDungLV)
        VALUES (${Ma}, ${NgayTao}, ${HoTen}, ${SoDienThoai}, ${CCCD_HoChieu}, ${ChucVu}, ${CongTy}, ${BienSoXe}, ${NoiDungLV})`;
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Save error' });
  }
});

// ✅ DELETE
app.delete('/api/delete/:ma', verifyToken, async (req, res) => {
  try {
    const ma = req.params.ma;
    const pool = await sql.connect(config);

    // Xóa trong bảng History trước (nếu có liên kết)
    await pool.request()
      .input('Ma', sql.NVarChar, ma)
      .query('DELETE FROM History WHERE Ma = @Ma');

    // Xóa trong bảng ThongTinDangKy
    await pool.request()
      .input('Ma', sql.NVarChar, ma)
      .query('DELETE FROM ThongTinDangKy WHERE Ma = @Ma');

    res.json({ success: true });
  } catch (err) {
    console.error("Lỗi khi xóa:", err);
    res.status(500).json({ error: 'Delete error' });
  }
});
  

//Check mã QR code
app.get('/api/check-code', async (req, res) => {
  const code = req.query.code;
  try {
    await sql.connect(config);
    const result = await sql.query`SELECT * FROM ThongTinDangKy WHERE Ma = ${code}`;
    if (result.recordset.length > 0) {
      res.json({ found: true, data: result.recordset[0] });
    } else {
      res.json({ found: false });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

//Update chỗ quét QR
app.post('/api/update-all', async (req, res) => {
  const { Ma, BienSoXe, NoiDungLV, Type_Customer, Status } = req.body;

  if (!Ma || !Status) return res.status(400).json({ error: "Thiếu mã hoặc trạng thái" });

  try {
    await sql.connect(config);

    // Xác định HetHan
    const hetHanDate = Type_Customer === "Nội bộ"
      ? new Date("2099-01-01T00:00:00")
      : new Date(Date.now() + 7 * 60 * 60 * 1000);

    // Cập nhật bảng ThongTinDangKy
    const updateQuery = `
      UPDATE ThongTinDangKy SET
        BienSoXe = @BienSoXe,
        NoiDungLV = @NoiDungLV,
        Type_Customer = @Type_Customer,
        Status = @Status,
        HetHan = @HetHan
      WHERE Ma = @Ma;
    `;

    const updateReq = new sql.Request()
      .input("Ma", sql.NVarChar, Ma)
      .input("BienSoXe", sql.NVarChar, BienSoXe)
      .input("NoiDungLV", sql.NVarChar, NoiDungLV)
      .input("Type_Customer", sql.NVarChar, Type_Customer)
      .input("Status", sql.NVarChar, Status)
      .input("HetHan", sql.DateTime, hetHanDate);

    await updateReq.query(updateQuery);

    // Lấy thông tin người dùng để lưu vào bảng History
    const getUser = await sql.query`SELECT HoTen FROM ThongTinDangKy WHERE Ma = ${Ma}`;
    const hoTen = getUser.recordset[0]?.HoTen || '';

    // Thêm bản ghi vào bảng History
    await sql.query`
      INSERT INTO History (Ma, HoTen, Type_Customer, Status, BienSoXe, ThoiGian)
      VALUES (${Ma}, ${hoTen}, ${Type_Customer}, ${Status}, ${BienSoXe}, GETDATE())
    `;

    res.json({ success: true });
  } catch (err) {
    console.error("Lỗi update-all:", err);
    res.status(500).json({ success: false, error: "Lỗi DB" });
  }
});


//Update het han QR code
app.post('/api/set-expiry', verifyToken, async (req, res) => {
  const { Ma, HetHan } = req.body;
  if (!Ma || !HetHan) {
    return res.status(400).json({ error: 'Thiếu Ma hoặc HetHan' });
  }
  try {
    const datetime = new Date(Number(HetHan));
    await sql.connect(config);
    await sql.query`
      UPDATE ThongTinDangKy
      SET HetHan = ${datetime}
      WHERE Ma = ${Ma}`;
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi khi cập nhật thời gian hết hạn' });
  }
});

//xu li file excel
app.post('/api/import-excel', async (req, res) => {
  const rows = req.body.rows;
  if (!Array.isArray(rows)) return res.status(400).json({ error: 'Invalid data' });

  try {
    const pool = await sql.connect(config);
    for (const row of rows) {
      const {
        Ma, HoTen, ChucVu, CongTy, CCCD_HoChieu,
        SoDienThoai, BienSoXe, NoiDungLV, NgayTao, HetHan
      } = row;

      const ngayTaoDate = NgayTao ? new Date(NgayTao) : new Date();
      const hetHanDate = HetHan ? new Date(HetHan) : null;

      const exists = await pool.request()
        .input("Ma", sql.NVarChar, Ma)
        .query("SELECT 1 FROM ThongTinDangKy WHERE Ma = @Ma");

      const reqDb = pool.request()
        .input("Ma", sql.NVarChar, Ma)
        .input("NgayTao", sql.DateTime, ngayTaoDate)
        .input("HoTen", sql.NVarChar, HoTen)
        .input("SoDienThoai", sql.NVarChar, SoDienThoai)
        .input("CCCD_HoChieu", sql.NVarChar, CCCD_HoChieu)
        .input("ChucVu", sql.NVarChar, ChucVu)
        .input("CongTy", sql.NVarChar, CongTy)
        .input("BienSoXe", sql.NVarChar, BienSoXe)
        .input("NoiDungLV", sql.NVarChar, NoiDungLV)
        .input("HetHan", sql.DateTime, hetHanDate);

      if (exists.recordset.length > 0) {
        await reqDb.query(`UPDATE ThongTinDangKy SET 
          NgayTao=@NgayTao, HoTen=@HoTen, SoDienThoai=@SoDienThoai,
          CCCD_HoChieu=@CCCD_HoChieu, ChucVu=@ChucVu, CongTy=@CongTy,
          BienSoXe=@BienSoXe, NoiDungLV=@NoiDungLV, HetHan=@HetHan
          WHERE Ma=@Ma`);
      } else {
        await reqDb
          .input("Status", sql.NVarChar, null)
          .query(`INSERT INTO ThongTinDangKy 
            (Ma, NgayTao, HoTen, SoDienThoai, CCCD_HoChieu, ChucVu, CongTy, BienSoXe, NoiDungLV, HetHan, Status)
            VALUES (@Ma, @NgayTao, @HoTen, @SoDienThoai, @CCCD_HoChieu, @ChucVu, @CongTy, @BienSoXe, @NoiDungLV, @HetHan, @Status)`);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Import Excel error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});


app.get('/api/history', verifyToken, async (req, res) => {
  try {
    await sql.connect(config);
    const result = await sql.query(`
      SELECT 
        h.*, 
        t.CongTy 
      FROM History h
      LEFT JOIN ThongTinDangKy t ON h.Ma = t.Ma
      ORDER BY h.ThoiGian DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error("Lỗi khi load lịch sử:", err);
    res.status(500).json({ error: "Lỗi DB" });
  }
});


app.get('/api/export-history-full', async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query(`
      SELECT 
        h.Id,
        h.Ma,
        t.HoTen,
        t.CongTy,
        t.ChucVu,
        h.Type_Customer,
        h.Status,
        h.ThoiGian,
        h.BienSoXe,
        t.NoiDungLV,
        t.CCCD_HoChieu,
        t.SoDienThoai, 
        t.NgayTao,
        t.HetHan
      FROM History h
      LEFT JOIN ThongTinDangKy t ON h.Ma = t.Ma
      ORDER BY h.ThoiGian DESC
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error("Lỗi export full:", err);
    res.status(500).json({ error: "Lỗi khi join dữ liệu" });
  }
});



app.listen(3000, () => console.log('Server running on http://localhost:3000'));
