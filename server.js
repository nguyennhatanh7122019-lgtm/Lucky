// ============================================================
// AutoDaily Log Server
// ============================================================

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const API_KEY = process.env.AUTODAILY_API_KEY || "autodaily1234";
const LOG_FILE = path.join(__dirname, "logs.json");

// Giữ log trong 7 ngày. Đổi số này (hoặc đặt biến môi trường AUTODAILY_RETENTION_DAYS)
// nếu muốn giữ lâu hơn/ngắn hơn.
const RETENTION_DAYS = Number(process.env.AUTODAILY_RETENTION_DAYS || 7);
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

// Giới hạn an toàn để tránh file phình vô hạn nếu lượng log/ngày quá lớn.
// Đây KHÔNG phải giới hạn chính (giới hạn chính là theo thời gian ở trên).
const MAX_LOGS_KEPT = Number(process.env.AUTODAILY_MAX_LOGS || 200000);

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ---- Đọc/ghi file log ----

function readLogsFromDisk() {
    try {
        if (!fs.existsSync(LOG_FILE)) return [];
        const raw = fs.readFileSync(LOG_FILE, "utf-8");
        if (!raw.trim()) return [];
        return JSON.parse(raw);
    } catch (err) {
        // Không bao giờ âm thầm coi như "không có log" khi đọc lỗi — làm vậy rồi lỡ ghi đè
        // sẽ xóa mất log cũ. Đổi tên file lỗi sang bản sao lưu để tự kiểm tra, và dừng server
        // lại thay vì chạy tiếp với dữ liệu rỗng.
        console.error("Lỗi đọc file log:", err);
        try {
            if (fs.existsSync(LOG_FILE)) {
                const backupFile = LOG_FILE + ".corrupted-" + Date.now();
                fs.copyFileSync(LOG_FILE, backupFile);
                console.error(`Đã sao lưu file lỗi sang: ${backupFile}`);
                console.error(`Kiểm tra file đó, sửa lại logs.json cho đúng định dạng JSON rồi khởi động lại server.`);
            }
        } catch (backupErr) {
            console.error("Không sao lưu được file lỗi:", backupErr);
        }
        throw new Error("Dừng khởi động server vì không đọc được logs.json (xem log lỗi phía trên).");
    }
}

// Ghi qua file tạm rồi đổi tên, tránh làm hỏng logs.json nếu server tắt
// đột ngột giữa lúc đang ghi.
function writeLogsToDisk(logs) {
    try {
        const tmpFile = LOG_FILE + ".tmp";
        fs.writeFileSync(tmpFile, JSON.stringify(logs), "utf-8");
        fs.renameSync(tmpFile, LOG_FILE);
    } catch (err) {
        console.error("Lỗi ghi file log:", err);
    }
}

// Bỏ các log cũ hơn RETENTION_MS, đồng thời áp giới hạn an toàn MAX_LOGS_KEPT.
// logsCache luôn được giữ mới nhất -> cũ nhất (unshift khi thêm).
function pruneOldLogs(logs) {
    const cutoff = Date.now() - RETENTION_MS;
    let pruned = logs.filter((l) => {
        const t = Date.parse(l.receivedAt);
        return isNaN(t) || t >= cutoff; // giữ lại log không đọc được thời gian, để không mất dữ liệu nhầm
    });
    if (pruned.length > MAX_LOGS_KEPT) {
        pruned = pruned.slice(0, MAX_LOGS_KEPT);
    }
    return pruned;
}

// ---- Cache trong bộ nhớ (đọc file 1 lần lúc khởi động, sau đó ghi-qua) ----

let logsCache = readLogsFromDisk();
{
    const beforeCount = logsCache.length;
    logsCache = pruneOldLogs(logsCache);
    if (logsCache.length !== beforeCount) {
        console.log(`[CLEANUP] Lúc khởi động: đã xóa ${beforeCount - logsCache.length} log quá ${RETENTION_DAYS} ngày.`);
        writeLogsToDisk(logsCache);
    }
    // Nếu không có gì bị xóa, KHÔNG ghi lại file — tránh mọi rủi ro ghi đè ngoài ý muốn.
}

let pendingSave = false;
function saveSoon() {
    // gộp nhiều lần ghi liên tiếp lại, tránh ghi đĩa liên tục khi log dồn dập
    if (pendingSave) return;
    pendingSave = true;
    setImmediate(() => {
        pendingSave = false;
        writeLogsToDisk(logsCache);
    });
}

// Dọn log quá hạn định kỳ, kể cả khi không có log mới nào gửi tới.
setInterval(() => {
    const before = logsCache.length;
    logsCache = pruneOldLogs(logsCache);
    if (logsCache.length !== before) {
        console.log(`[CLEANUP] Đã xóa ${before - logsCache.length} log quá ${RETENTION_DAYS} ngày.`);
        saveSoon();
    }
}, 60 * 60 * 1000); // mỗi 1 giờ

// API nhận log từ bot
app.post("/api/log", (req, res) => {
    const apiKey = req.headers["x-api-key"];
    if (apiKey !== API_KEY) {
        return res.status(401).json({ ok: false, error: "Sai API key" });
    }

    const { account, chestType, items, questName, note } = req.body || {};
    if (!account) {
        return res.status(400).json({ ok: false, error: "Thiếu trường 'account'" });
    }

    const entry = {
        id: Date.now() + "-" + Math.random().toString(36).slice(2, 8),
        account: String(account),
        chestType: chestType ? String(chestType) : null,
        items: Array.isArray(items) ? items.map(String) : (items ? [String(items)] : []),
        questName: questName ? String(questName) : null,
        note: note ? String(note) : null,
        receivedAt: new Date().toISOString(),
    };

    logsCache.unshift(entry);
    if (logsCache.length > MAX_LOGS_KEPT) logsCache.length = MAX_LOGS_KEPT;
    saveSoon();

    console.log(`[LOG] ${entry.account} -> ${entry.chestType || "?"} : ${entry.items.join(", ") || "(không rõ)"}`);
    res.json({ ok: true, entry });
});

// API lấy dữ liệu cho dashboard
app.get("/api/logs", (req, res) => {
    let logs = logsCache;
    const accountFilter = req.query.account;
    if (accountFilter) {
        const f = String(accountFilter).toLowerCase();
        logs = logs.filter((l) => l.account.toLowerCase().includes(f));
    }
    const limit = parseInt(req.query.limit, 10);
    if (!isNaN(limit) && limit > 0) {
        logs = logs.slice(0, limit);
    }
    res.json({ ok: true, count: logs.length, logs });
});

app.listen(PORT, () => {
    console.log(`AutoDaily Log Server đang chạy tại http://localhost:${PORT}`);
    console.log(`API key hiện tại: ${API_KEY}`);
    console.log(`Đang giữ log trong ${RETENTION_DAYS} ngày (hiện có ${logsCache.length} log).`);
});