const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Menjadikan folder public bisa diakses langsung

// 1. Setup Database JSON Sederhana & Kuat
const dbPath = path.join(__dirname, 'data', 'db.json');
const initDB = () => {
    if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));
    if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify({ users: [], files: [] }));
};
initDB();

const readDB = () => JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const writeDB = (data) => fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

// 2. Setup Multer (Untuk Upload File)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});
const upload = multer({ storage: storage });

// --- API ENDPOINTS ---

// API Register
app.post('/api/register', (req, res) => {
    const { username, password, name, kelas } = req.body;
    const db = readDB();
    if (db.users.find(u => u.username === username)) {
        return res.status(400).json({ message: "Username sudah dipakai!" });
    }
    db.users.push({ username, password, name, kelas });
    writeDB(db);
    res.json({ message: "Pendaftaran sukses! Silakan login." });
});

// API Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.username === username && u.password === password);
    if (user) {
        res.json({ message: "Login berhasil", user: { username: user.username, name: user.name, kelas: user.kelas } });
    } else {
        res.status(401).json({ message: "Username atau password salah!" });
    }
});

// API Upload File
app.post('/api/upload', upload.single('document'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: "File gagal diunggah." });
    const username = req.headers.username;
    if (!username) return res.status(401).json({ message: "Akses ditolak." });

    const db = readDB();
    const newFile = {
        id: Date.now().toString(),
        owner: username,
        originalName: req.file.originalname,
        filename: req.file.filename,
        size: (req.file.size / 1024).toFixed(1) + ' KB',
        date: new Date().toLocaleDateString('id-ID'),
        url: `/uploads/${req.file.filename}`
    };
    
    db.files.push(newFile);
    writeDB(db);
    res.json({ message: "File berhasil disimpan di server!", file: newFile });
});

// API Get User Files
app.get('/api/files/:username', (req, res) => {
    const db = readDB();
    const userFiles = db.files.filter(f => f.owner === req.params.username);
    res.json(userFiles);
});

// API Delete File
app.delete('/api/files/:id', (req, res) => {
    const db = readDB();
    const fileIndex = db.files.findIndex(f => f.id === req.params.id);
    if (fileIndex > -1) {
        const file = db.files[fileIndex];
        // Hapus file fisik
        const filePath = path.join(__dirname, 'public', 'uploads', file.filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        // Hapus dari database
        db.files.splice(fileIndex, 1);
        writeDB(db);
        res.json({ message: "File dihapus." });
    } else {
        res.status(404).json({ message: "File tidak ditemukan." });
    }
});

app.listen(PORT, () => console.log(`🚀 Server berjalan di http://localhost:${PORT}`));