// ============================================================
// AutoDaily Log Server (Tích hợp Dashboard HTML trực tiếp + Chống ngủ đông)
// ============================================================

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const https = require("https");

const app = express();
const PORT = process.env.PORT || 3000;

const API_KEY = process.env.AUTODAILY_API_KEY || "autodaily1234";
const LOG_FILE = path.join(__dirname, "logs.json");

const RETENTION_DAYS = Number(process.env.AUTODAILY_RETENTION_DAYS || 7);
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;
const MAX_LOGS_KEPT = Number(process.env.AUTODAILY_MAX_LOGS || 200000);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ============================================================
// GIAO DIỆN DASHBOARD (Được tích hợp trực tiếp vào đây)
// ============================================================
const HTML_DASHBOARD = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AutoDaily Dashboard - Tra Cứu Tài Khoản</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen p-6">
    <div class="max-w-7xl mx-auto">
        <header class="mb-8 border-b border-slate-700 pb-4">
            <h1 class="text-3xl font-bold text-emerald-400">🛡️ AutoDaily Dashboard Management</h1>
            <p class="text-slate-400 mt-1">Hệ thống phân loại và tra cứu tài khoản theo Hòm quà, Rương và Nhiệm vụ.</p>
        </header>

        <!-- GRID CHIA LÀM 3 PHẦN -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">

            <!-- PHẦN 1: CHỌN LOẠI HÒM QUÀ + SỐ SAO -->
            <div class="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-lg flex flex-col">
                <h2 class="text-xl font-semibold text-amber-400 mb-3">1. Tra cứu Hòm quà + Số sao</h2>
                <p class="text-xs text-slate-400 mb-4">Chọn loại hòm quà và cấp độ sao tương ứng</p>

                <div class="space-y-3 mb-4">
                    <div>
                        <label class="block text-sm font-medium text-slate-300 mb-1">Loại hòm quà:</label>
                        <select id="p1-type" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-400 text-slate-200">
                            <option value="">-- Tất cả loại --</option>
                            <option value="vũ khí">Hòm quà vũ khí</option>
                            <option value="giáp">Hòm quà giáp</option>
                            <option value="trang sức">Hòm quà trang sức</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-slate-300 mb-1">Chọn số sao:</label>
                        <div class="grid grid-cols-5 gap-1.5" id="star-buttons">
                            <button type="button" onclick="setStarFilter('1sao', this)" class="star-btn bg-slate-900 border border-slate-700 hover:border-amber-400 py-1.5 rounded text-xs transition font-medium">1 sao</button>
                            <button type="button" onclick="setStarFilter('2sao', this)" class="star-btn bg-slate-900 border border-slate-700 hover:border-amber-400 py-1.5 rounded text-xs transition font-medium">2 sao</button>
                            <button type="button" onclick="setStarFilter('3sao', this)" class="star-btn bg-slate-900 border border-slate-700 hover:border-amber-400 py-1.5 rounded text-xs transition font-medium">3 sao</button>
                            <button type="button" onclick="setStarFilter('4sao', this)" class="star-btn bg-slate-900 border border-slate-700 hover:border-amber-400 py-1.5 rounded text-xs transition font-medium">4 sao</button>
                            <button type="button" onclick="setStarFilter('5sao', this)" class="star-btn bg-slate-900 border border-slate-700 hover:border-amber-400 py-1.5 rounded text-xs transition font-medium">5 sao</button>
                        </div>
                        <input type="hidden" id="p1-star-value" value="">
                    </div>

                    <button onclick="filterSection1()" class="w-full bg-amber-600 hover:bg-amber-500 font-medium py-2 rounded text-sm transition mt-2">Tìm kiếm Acc</button>
                </div>

                <div id="p1-toolbar"></div>
                <div class="flex-1 bg-slate-900/50 rounded p-3 overflow-y-auto max-h-80 border border-slate-700/50" id="p1-results">
                    <span class="text-slate-500 text-sm">Chưa có kết quả lọc...</span>
                </div>
            </div>

            <!-- PHẦN 2: LỌC THEO CHEST TYPE (RƯƠNG) -->
            <div class="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-lg flex flex-col">
                <h2 class="text-xl font-semibold text-cyan-400 mb-3">2. Tra cứu theo Rương</h2>
                <p class="text-xs text-slate-400 mb-4">Lọc các tài khoản mở theo loại rương (Chest Type)</p>

                <div class="space-y-3 mb-4">
                    <div>
                        <label class="block text-sm font-medium text-slate-300 mb-1">Loại Rương:</label>
                        <input type="text" id="p2-chest" placeholder="Ví dụ: armor key, hòm quà..." class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-400">
                    </div>
                    <button onclick="filterSection2()" class="w-full bg-cyan-600 hover:bg-cyan-500 font-medium py-2 rounded text-sm transition mt-7">Tìm kiếm Acc</button>
                </div>

                <div id="p2-toolbar"></div>
                <div class="flex-1 bg-slate-900/50 rounded p-3 overflow-y-auto max-h-80 border border-slate-700/50" id="p2-results">
                    <span class="text-slate-500 text-sm">Chưa có kết quả lọc...</span>
                </div>
            </div>

            <!-- PHẦN 3: LỌC THEO NHIỆM VỤ (QUEST) HOẶC TÀI KHOẢN -->
            <div class="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-lg flex flex-col">
                <h2 class="text-xl font-semibold text-emerald-400 mb-3">3. Tra cứu theo Quest / Account</h2>
                <p class="text-xs text-slate-400 mb-4">Lọc theo tên nhiệm vụ hoặc tìm trực tiếp tên tài khoản</p>

                <div class="space-y-3 mb-4">
                    <div>
                        <label class="block text-sm font-medium text-slate-300 mb-1">Tên Quest / Tài khoản:</label>
                        <input type="text" id="p3-query" placeholder="Ví dụ: thỏ hoang mạc, ijustclone..." class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-400">
                    </div>
                    <button onclick="filterSection3()" class="w-full bg-emerald-600 hover:bg-emerald-500 font-medium py-2 rounded text-sm transition mt-7">Tìm kiếm Acc</button>
                </div>

                <div id="p3-toolbar"></div>
                <div class="flex-1 bg-slate-900/50 rounded p-3 overflow-y-auto max-h-80 border border-slate-700/50" id="p3-results">
                    <span class="text-slate-500 text-sm">Chưa có kết quả lọc...</span>
                </div>
            </div>

        </div>

        <!-- BẢNG HIỂN THỊ TẤT CẢ LOG GẦN NHẤT (DƯỚI CÙNG) -->
        <div class="mt-8 bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-lg">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h2 class="text-lg font-bold text-slate-200">📋 Nhật ký hoạt động gần đây (Tất cả)</h2>
                <div class="flex items-center gap-3">
                    <span id="all-count" class="text-xs text-slate-400"></span>
                    <button type="button" onclick="exportAllLogs()"
                            class="px-2 py-1 rounded border border-slate-600 hover:border-amber-400 text-xs text-slate-300 hover:text-amber-300 transition">
                        ⬇ Xuất .txt
                    </button>
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left text-sm text-slate-300">
                    <thead class="bg-slate-900 text-slate-400 uppercase text-xs">
                        <tr>
                            <th class="p-3 w-16">Đã xem</th>
                            <th class="p-3">Thời gian</th>
                            <th class="p-3">Tài khoản</th>
                            <th class="p-3">Loại Rương</th>
                            <th class="p-3">Vật phẩm nhận được</th>
                            <th class="p-3">Quest</th>
                        </tr>
                    </thead>
                    <tbody id="all-logs-table" class="divide-y divide-slate-700">
                        <tr><td colspan="6" class="p-4 text-center text-slate-500">Đang tải dữ liệu...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <script>
        let allLogsCache = [];
        let selectedStar = "";
        const SEEN_STORAGE_KEY = 'autodaily_seen_v1';
        const SEEN_MAX = 5000;
        let seenSet = loadSeen();

        function loadSeen() {
            try { return new Set(JSON.parse(localStorage.getItem(SEEN_STORAGE_KEY) || '[]')); } catch (e) { return new Set(); }
        }

        function saveSeen() {
            try {
                while (seenSet.size > SEEN_MAX) seenSet.delete(seenSet.values().next().value);
                localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify([...seenSet]));
            } catch (e) {}
        }

        function logKey(l) {
            if (l.id !== undefined && l.id !== null) return String(l.id);
            return [l.account, l.receivedAt, l.chestType || '', (l.items || []).join(',')].join('|');
        }

        function isSeen(l) { return seenSet.has(logKey(l)); }

        function escapeHtml(v) {
            return String(v ?? '').replace(/[&<>"']/g, c => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            }[c]));
        }

        const sections = {
            p1: { title: "Hòm quà + Số sao", slug: "hom-qua", desc: "", predicate: null, showSeen: false, emptyText: "Không tìm thấy tài khoản phù hợp." },
            p2: { title: "Theo Rương", slug: "ruong", desc: "", predicate: null, showSeen: false, emptyText: "Không tìm thấy tài khoản mở loại rương này." },
            p3: { title: "Theo Quest / Account", slug: "quest-account", desc: "", predicate: null, showSeen: false, emptyText: "Không tìm thấy dữ liệu phù hợp." }
        };

        async function fetchLogs() {
            try {
                const res = await fetch('/api/logs');
                const data = await res.json();
                if (data.ok) { allLogsCache = data.logs; renderAll(); }
            } catch (err) { console.error("Lỗi tải logs:", err); }
        }

        function renderAll() {
            renderAllLogsTable(allLogsCache);
            Object.keys(sections).forEach(renderSection);
        }

        function renderAllLogsTable(logs) {
            const tbody = document.getElementById('all-logs-table');
            const unseen = logs.filter(l => !isSeen(l)).length;
            document.getElementById('all-count').innerHTML = \`<span class="font-bold text-white">\${unseen}</span> chưa xem / tổng \${logs.length}\`;

            if (logs.length === 0) {
                tbody.innerHTML = \`<tr><td colspan="6" class="p-4 text-center text-slate-500">Không có dữ liệu log nào.</td></tr>\`;
                return;
            }
            tbody.innerHTML = logs.map(l => {
                const seen = isSeen(l);
                return \`
                <tr data-row class="hover:bg-slate-700/50 transition \${seen ? 'opacity-40' : ''}">
                    <td class="p-3">
                        <input type="checkbox" class="seen-cb h-4 w-4 cursor-pointer accent-emerald-500" title="Đánh dấu đã xem"
                               data-key="\${escapeHtml(logKey(l))}" \${seen ? 'checked' : ''}>
                    </td>
                    <td class="p-3 text-xs text-slate-400">\${escapeHtml(new Date(l.receivedAt).toLocaleString())}</td>
                    <td class="p-3 font-semibold text-emerald-400">\${escapeHtml(l.account)}</td>
                    <td class="p-3 text-cyan-300">\${escapeHtml(l.chestType || '-')}</td>
                    <td class="p-3">\${escapeHtml((l.items || []).join(', '))}</td>
                    <td class="p-3 text-amber-300">\${escapeHtml(l.questName || '-')}</td>
                </tr>\`;
            }).join('');
        }

        function setStarFilter(star, btnElement) {
            if (selectedStar === star) {
                selectedStar = "";
                btnElement.classList.remove('bg-amber-600', 'border-amber-400', 'text-white');
                btnElement.classList.add('bg-slate-900', 'border-slate-700');
            } else {
                document.querySelectorAll('.star-btn').forEach(b => {
                    b.classList.remove('bg-amber-600', 'border-amber-400', 'text-white');
                    b.classList.add('bg-slate-900', 'border-slate-700');
                });
                selectedStar = star;
                btnElement.classList.remove('bg-slate-900', 'border-slate-700');
                btnElement.classList.add('bg-amber-600', 'border-amber-400', 'text-white');
            }
            document.getElementById('p1-star-value').value = selectedStar;
        }

        function filterSection1() {
            const typeKeyword = document.getElementById('p1-type').value.toLowerCase().trim();
            const starKeyword = document.getElementById('p1-star-value').value.trim();
            const starNum = starKeyword.replace('sao', '');
            const starRegex = starKeyword ? new RegExp('(?<!\\d)' + starNum + '\\s*sao|\\+' + starNum + '(?!\\d)') : null;

            sections.p1.desc = \`Loại: \${typeKeyword || 'tất cả'} | Sao: \${starNum || 'tất cả'}\`;
            sections.p1.predicate = l => {
                const targetText = ((l.chestType || '') + " " + (l.items || []).join(" ")).toLowerCase();
                const matchType = typeKeyword === "" || targetText.includes(typeKeyword);
                const matchStar = !starRegex || starRegex.test(targetText);
                return matchType && matchStar;
            };
            renderSection('p1', true);
        }

        function filterSection2() {
            const chestKeyword = document.getElementById('p2-chest').value.toLowerCase().trim();
            sections.p2.desc = \`Rương: \${chestKeyword || 'tất cả'}\`;
            sections.p2.predicate = l => !!l.chestType && l.chestType.toLowerCase().includes(chestKeyword);
            renderSection('p2', true);
        }

        function filterSection3() {
            const query = document.getElementById('p3-query').value.toLowerCase().trim();
            sections.p3.desc = \`Quest/Account: \${query || 'tất cả'}\`;
            sections.p3.predicate = l => {
                const matchAcc = (l.account || '').toLowerCase().includes(query);
                const matchQuest = !!l.questName && l.questName.toLowerCase().includes(query);
                return matchAcc || matchQuest;
            };
            renderSection('p3', true);
        }

        document.getElementById('p2-chest').addEventListener('keydown', e => { if (e.key === 'Enter') filterSection2(); });
        document.getElementById('p3-query').addEventListener('keydown', e => { if (e.key === 'Enter') filterSection3(); });

        function renderSection(id, resetScroll = false) {
            const s = sections[id];
            if (!s.predicate) return;
            const container = document.getElementById(\`\${id}-results\`);
            const matched = allLogsCache.filter(s.predicate);
            const unseenList = matched.filter(l => !isSeen(l));
            const list = s.showSeen ? matched : unseenList;
            const prevScroll = container.scrollTop;

            renderToolbar(id, matched.length, unseenList.length);

            if (list.length === 0) {
                const msg = matched.length > 0 ? "✅ Đã xem hết các mục trong bộ lọc này." : s.emptyText;
                container.innerHTML = \`<span class="text-slate-500 text-sm">\${escapeHtml(msg)}</span>\`;
            } else {
                container.innerHTML = list.map(cardHtml).join('');
            }
            container.scrollTop = resetScroll ? 0 : prevScroll;
        }

        function renderToolbar(id, total, unseen) {
            const s = sections[id];
            const disabled = unseen === 0 ? 'opacity-40 pointer-events-none' : '';
            document.getElementById(\`\${id}-toolbar\`).innerHTML = \`
                <div class="flex flex-wrap items-center justify-between gap-2 mb-2 text-xs">
                    <div class="text-slate-300">
                        <span class="text-base font-bold text-white">\${unseen}</span> chưa xem
                        <span class="text-slate-500">/ tổng \${total}</span>
                    </div>
                    <div class="flex items-center gap-3">
                        <label class="flex items-center gap-1 text-slate-400 cursor-pointer select-none">
                            <input type="checkbox" class="accent-emerald-500" \${s.showSeen ? 'checked' : ''}
                                   onchange="toggleShowSeen('\${id}', this.checked)">
                            Hiện cả đã xem
                        </label>
                        <button type="button" onclick="markAllSeen('\${id}')"
                                class="px-2 py-1 rounded border border-slate-600 hover:border-emerald-400 text-slate-300 hover:text-emerald-300 transition \${disabled}">
                            ✔ Xem hết
                        </button>
                        <button type="button" onclick="exportSection('\${id}')"
                                class="px-2 py-1 rounded border border-slate-600 hover:border-amber-400 text-slate-300 hover:text-amber-300 transition">
                            ⬇ Xuất .txt
                        </button>
                    </div>
                </div>\`;
        }

        function cardHtml(l) {
            const seen = isSeen(l);
            return \`
                <div data-row class="flex gap-2.5 bg-slate-800 p-2.5 rounded mb-2 border text-xs transition-opacity \${seen ? 'border-slate-700/40 opacity-50' : 'border-slate-700'}">
                    <input type="checkbox" class="seen-cb mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-emerald-500" title="Đánh dấu đã xem"
                           data-key="\${escapeHtml(logKey(l))}" \${seen ? 'checked' : ''}>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between font-bold text-slate-200">
                            <span class="text-emerald-400 truncate">👤 \${escapeHtml(l.account)}</span>
                            <span class="text-slate-400 text-[10px] shrink-0 ml-2">\${escapeHtml(new Date(l.receivedAt).toLocaleTimeString())}</span>
                        </div>
                        <div class="mt-1 text-slate-300">🎁 Items: <span class="text-amber-300">\${escapeHtml((l.items || []).join(', '))}</span></div>
                        \${l.chestType ? \`<div class="text-slate-400">Rương: \${escapeHtml(l.chestType)}</div>\` : ''}
                        \${l.questName ? \`<div class="text-slate-400">Quest: \${escapeHtml(l.questName)}</div>\` : ''}
                    </div>
                </div>\`;
        }

        document.addEventListener('change', e => {
            const cb = e.target.closest ? e.target.closest('.seen-cb') : null;
            if (!cb) return;
            const key = cb.dataset.key;
            if (cb.checked) seenSet.add(key); else seenSet.delete(key);
            saveSeen();
            const row = cb.closest('[data-row]');
            if (row) row.classList.add('opacity-30', 'transition-opacity');
            setTimeout(renderAll, 180);
        });

        function toggleShowSeen(id, checked) {
            sections[id].showSeen = checked;
            renderSection(id, true);
        }

        function markAllSeen(id) {
            const s = sections[id];
            if (!s.predicate) return;
            const targets = allLogsCache.filter(s.predicate).filter(l => !isSeen(l));
            if (targets.length === 0) return;
            if (!confirm(\`Đánh dấu \${targets.length} mục là đã xem?\`)) return;
            targets.forEach(l => seenSet.add(logKey(l)));
            saveSeen();
            renderAll();
        }

        function pad2(n) { return String(n).padStart(2, '0'); }
        function timestampForFile(d = new Date()) {
            return \`\${d.getFullYear()}\${pad2(d.getMonth() + 1)}\${pad2(d.getDate())}_\${pad2(d.getHours())}\${pad2(d.getMinutes())}\${pad2(d.getSeconds())}\`;
        }

        function logToLine(l) {
            const parts = [
                \`[\${new Date(l.receivedAt).toLocaleString()}] \${l.account}\`,
                \`Rương: \${l.chestType || '-'}\`,
                \`Items: \${(l.items || []).join(', ') || '-'}\`
            ];
            if (l.questName) parts.push(\`Quest: \${l.questName}\`);
            return parts.join(' | ');
        }

        function downloadTxt(filename, text) {
            const content = '\\uFEFF' + text.replace(/\\r?\\n/g, '\\r\\n');
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }

        function exportSection(id) {
            const s = sections[id];
            if (!s.predicate) return;
            const matched = allLogsCache.filter(s.predicate);
            const list = s.showSeen ? matched : matched.filter(l => !isSeen(l));
            if (list.length === 0) { alert("Không có dữ liệu để xuất."); return; }
            const header = [
                \`AutoDaily - \${s.title}\`,
                \`Bộ lọc: \${s.desc}\`,
                \`Xuất lúc: \${new Date().toLocaleString()}\`,
                \`Số mục: \${list.length}\${s.showSeen ? ' (gồm cả đã xem)' : ' (chưa xem)'}\`,
                '-'.repeat(40)
            ];
            downloadTxt(\`autodaily_\${s.slug}_\${timestampForFile()}.txt\`, header.concat(list.map(logToLine)).join('\\n'));
        }

        function exportAllLogs() {
            if (allLogsCache.length === 0) { alert("Không có dữ liệu để xuất."); return; }
            const unseen = allLogsCache.filter(l => !isSeen(l)).length;
            const header = [
                \`AutoDaily - Nhật ký hoạt động (tất cả)\`,
                \`Xuất lúc: \${new Date().toLocaleString()}\`,
                \`Số mục: \${allLogsCache.length} (chưa xem: \${unseen})\`,
                '-'.repeat(40)
            ];
            downloadTxt(\`autodaily_all_\${timestampForFile()}.txt\`, header.concat(allLogsCache.map(l => (isSeen(l) ? '[đã xem] ' : '') + logToLine(l))).join('\\n'));
        }

        window.addEventListener('storage', e => {
            if (e.key === SEEN_STORAGE_KEY) { seenSet = loadSeen(); renderAll(); }
        });

        fetchLogs();
        setInterval(fetchLogs, 10000);
    </script>
</body>
</html>`;

// ============================================================
// HỆ THỐNG SERVER EXPRESS
// ============================================================

// Route trang chủ hiển thị thẳng giao diện HTML tích hợp
app.get("/", (req, res) => {
    res.send(HTML_DASHBOARD);
});

function readLogsFromDisk() {
    try {
        if (!fs.existsSync(LOG_FILE)) return [];
        const raw = fs.readFileSync(LOG_FILE, "utf-8");
        if (!raw.trim()) return [];
        return JSON.parse(raw);
    } catch (err) {
        console.error("Lỗi đọc file log:", err);
        try {
            if (fs.existsSync(LOG_FILE)) {
                const backupFile = LOG_FILE + ".corrupted-" + Date.now();
                fs.copyFileSync(LOG_FILE, backupFile);
            }
        } catch (backupErr) {}
        throw new Error("Dừng khởi động server vì không đọc được logs.json.");
    }
}

function writeLogsToDisk(logs) {
    try {
        const tmpFile = LOG_FILE + ".tmp";
        fs.writeFileSync(tmpFile, JSON.stringify(logs), "utf-8");
        fs.renameSync(tmpFile, LOG_FILE);
    } catch (err) {
        console.error("Lỗi ghi file log:", err);
    }
}

function pruneOldLogs(logs) {
    const cutoff = Date.now() - RETENTION_MS;
    let pruned = logs.filter((l) => {
        const t = Date.parse(l.receivedAt);
        return isNaN(t) || t >= cutoff;
    });
    if (pruned.length > MAX_LOGS_KEPT) {
        pruned = pruned.slice(0, MAX_LOGS_KEPT);
    }
    return pruned;
}

let logsCache = readLogsFromDisk();
{
    const beforeCount = logsCache.length;
    logsCache = pruneOldLogs(logsCache);
    if (logsCache.length !== beforeCount) {
        writeLogsToDisk(logsCache);
    }
}

let pendingSave = false;
function saveSoon() {
    if (pendingSave) return;
    pendingSave = true;
    setImmediate(() => {
        pendingSave = false;
        writeLogsToDisk(logsCache);
    });
}

setInterval(() => {
    const before = logsCache.length;
    logsCache = pruneOldLogs(logsCache);
    if (logsCache.length !== before) {
        saveSoon();
    }
}, 60 * 60 * 1000);

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

    // ============================================================
    // Cơ chế tự Ping (Self-Ping) mỗi 10 phút chống ngủ đông trên Render
    // ============================================================
    const SELF_URL = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL;
    if (SELF_URL) {
        const PING_INTERVAL = 10 * 60 * 1000; // 10 phút
        setInterval(() => {
            https.get(SELF_URL, (res) => {
                console.log(`[SELF-PING] Giữ kết nối thành công tới ${SELF_URL} - Trạng thái: ${res.statusCode}`);
            }).on("error", (err) => {
                console.error(`[SELF-PING] Lỗi khi tự ping server:`, err.message);
            });
        }, PING_INTERVAL);
        console.log(`[SELF-PING] Đã kích hoạt cơ chế tự ping mỗi 10 phút đến: ${SELF_URL}`);
    } else {
        console.log(`[SELF-PING] Chưa cấu hình biến môi trường RENDER_EXTERNAL_URL.`);
    }
});
