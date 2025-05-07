// index.js
const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const path = require('path');

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


// ✅ GET all data
app.get('/api/all', async (req, res) => {
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
  app.post('/api/save', async (req, res) => {
    const {
      Ma, NgayTao, HoTen, SoDienThoai,
      CCCD_HoChieu, ChucVu, CongTy, BienSoXe, NoiDungLV
    } = req.body;
  
    try {
      await sql.connect(config);
      const check = await sql.query`SELECT 1 FROM ThongTinDangKy WHERE Ma = ${Ma}`;
      if (check.recordset.length > 0) {
        // update
        await sql.query`
          UPDATE ThongTinDangKy
          SET NgayTao=${NgayTao}, HoTen=${HoTen}, SoDienThoai=${SoDienThoai},
              CCCD_HoChieu=${CCCD_HoChieu}, ChucVu=${ChucVu},
              CongTy=${CongTy}, BienSoXe=${BienSoXe}, NoiDungLV=${NoiDungLV}
          WHERE Ma=${Ma}`;
      } else {
        // insert
        await sql.query`
          INSERT INTO ThongTinDangKy
          (Ma, NgayTao, HoTen, SoDienThoai, CCCD_HoChieu, ChucVu, CongTy, BienSoXe,NoiDungLV)
          VALUES (${Ma}, ${NgayTao}, ${HoTen}, ${SoDienThoai}, ${CCCD_HoChieu}, ${ChucVu}, ${CongTy}, ${BienSoXe}, ${NoiDungLV})`;
      }
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Save error' });
    }
  });
  
  // ✅ DELETE
  app.delete('/api/delete/:ma', async (req, res) => {
    try {
      await sql.connect(config);
      await sql.query`DELETE FROM ThongTinDangKy WHERE Ma = ${req.params.ma}`;
      res.json({ success: true });
    } catch (err) {
      console.error(err);
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

app.post('/api/update-all', async (req, res) => {
  const { Ma, BienSoXe, NoiDungLV, Type_Customer, Status } = req.body;

  if (!Ma) return res.status(400).json({ error: "Thiếu mã" });

  try {
    await sql.connect(config);
    const query = `
      UPDATE ThongTinDangKy
      SET
        BienSoXe = @BienSoXe,
        NoiDungLV = @NoiDungLV,
        ${Type_Customer ? "Type_Customer = @Type_Customer," : ""}
        ${Status ? "Status = @Status," : ""}
        Ma = Ma
      WHERE Ma = @Ma
    `;

    const request = new sql.Request()
      .input("Ma", sql.NVarChar, Ma)
      .input("BienSoXe", sql.NVarChar, BienSoXe)
      .input("NoiDungLV", sql.NVarChar, NoiDungLV);

    if (Type_Customer) request.input("Type_Customer", sql.NVarChar, Type_Customer);
    if (Status) request.input("Status", sql.NVarChar, Status);

    await request.query(query);
    res.json({ success: true });
  } catch (err) {
    console.error("Lỗi update-all:", err);
    res.status(500).json({ success: false, error: "Lỗi DB" });
  }
});


//Update het han QR code
app.post('/api/set-expiry', async (req, res) => {
  const { Ma, HetHan } = req.body;

  if (!Ma || !HetHan) {
    return res.status(400).json({ error: 'Thiếu Ma hoặc HetHan' });
  }

  try {
    const datetime = new Date(Number(HetHan)); // Convert timestamp -> Date

    const pool = await sql.connect(config);
    await pool.request()
      .input('Ma', sql.NVarChar, Ma)
      .input('HetHan', sql.DateTime, datetime)
      .query('UPDATE ThongTinDangKy SET HetHan = @HetHan WHERE Ma = @Ma');

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
        Ma, NgayTao, HoTen, SoDienThoai,
        CCCD_HoChieu, ChucVu, CongTy, BienSoXe,
        NoiDungLV, HetHan 
      } = row;

      const check = await pool.request()
        .input('Ma', sql.NVarChar, Ma)
        .query('SELECT 1 FROM ThongTinDangKy WHERE Ma = @Ma');

      const ngayTaoDate = NgayTao ? new Date(NgayTao) : new Date();
      const hetHanDate = HetHan ? new Date(HetHan) : null;

      if (check.recordset.length > 0) {
        // update
        await pool.request()
          .input('Ma', sql.NVarChar, Ma)
          .input('NgayTao', sql.DateTime, ngayTaoDate)
          .input('HoTen', sql.NVarChar, HoTen)
          .input('SoDienThoai', sql.NVarChar, SoDienThoai)
          .input('CCCD_HoChieu', sql.NVarChar, CCCD_HoChieu)
          .input('ChucVu', sql.NVarChar, ChucVu)
          .input('CongTy', sql.NVarChar, CongTy)
          .input('BienSoXe', sql.NVarChar, BienSoXe)
          .input('NoiDungLV', sql.NVarChar, NoiDungLV)
          .input('HetHan', sql.DateTime, hetHanDate)
          .query(`UPDATE ThongTinDangKy SET 
            NgayTao=@NgayTao, HoTen=@HoTen, SoDienThoai=@SoDienThoai,
            CCCD_HoChieu=@CCCD_HoChieu, ChucVu=@ChucVu, CongTy=@CongTy,
            BienSoXe=@BienSoXe, NoiDungLV=@NoiDungLV, HetHan=@HetHan
            WHERE Ma=@Ma`);
      } else {
        // insert
        await pool.request()
          .input('Ma', sql.NVarChar, Ma)
          .input('NgayTao', sql.DateTime, ngayTaoDate)
          .input('HoTen', sql.NVarChar, HoTen)
          .input('SoDienThoai', sql.NVarChar, SoDienThoai)
          .input('CCCD_HoChieu', sql.NVarChar, CCCD_HoChieu)
          .input('ChucVu', sql.NVarChar, ChucVu)
          .input('CongTy', sql.NVarChar, CongTy)
          .input('BienSoXe', sql.NVarChar, BienSoXe)
          .input('NoiDungLV', sql.NVarChar, NoiDungLV)
          .input('HetHan', sql.DateTime, hetHanDate)
          .input('Status', sql.NVarChar, null) //Mặc định NULL
          .query(`INSERT INTO ThongTinDangKy 
            (Ma, NgayTao, HoTen, SoDienThoai, CCCD_HoChieu, ChucVu, CongTy, BienSoXe, NoiDungLV, HetHan, Status)
            VALUES (@Ma, @NgayTao, @HoTen, @SoDienThoai, @CCCD_HoChieu, @ChucVu, @CongTy, @BienSoXe, @NoiDungLV, @HetHan, @Status)`);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Import Excel error:", err);
    res.status(500).json({ success: false });
  }
});


app.listen(3000, () => console.log('Server running on http://localhost:3000'));
