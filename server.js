// index.js
const express = require('express');
const sql = require('mssql');
const cors = require('cors');

const app = express();
app.use(cors());

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

//Update bks và noidung
app.post("/api/update-extra", async (req, res) => {
  const { Ma, BienSoXe, NoiDungLV } = req.body;
  if (!Ma) return res.status(400).json({ error: "Thiếu mã" });

  try {
    await sql.connect(config);
    await sql.query`
      UPDATE ThongTinDangKy
      SET BienSoXe = ${BienSoXe}, NoiDungLV = ${NoiDungLV}
      WHERE Ma = ${Ma}`;
    res.json({ success: true });
  } catch (err) {
    console.error("Lỗi update-extra:", err);
    res.status(500).json({ success: false, error: "DB error" });
  }
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
