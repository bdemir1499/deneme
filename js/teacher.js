let allExams = [];
let approvedExams = [];
let pendingExams = [];
let allStudents = [];

// Sayfa yüklendiğinde oturum kontrolü yap
"use strict";

document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            // Firestore'dan rolü kontrol et
            db.collection('users').doc(user.uid).get().then(doc => {
                if (doc.exists && doc.data().role !== 'teacher') {
                    window.location.href = 'student.html';
                } else {
                    // Kullanıcı adı yazdır
                    document.getElementById('teacherNameDisplay').innerText = doc.data().name;
                    // Verileri yükle
                    loadData();
                }
            });
        }
    });
});

async function loadData() {
    try {
        // 1. Öğrencileri çek
        const usersSnapshot = await db.collection('users').where('role', '==', 'student').get();
        allStudents = [];
        usersSnapshot.forEach(doc => {
            allStudents.push({ uid: doc.id, ...doc.data() });
        });

        // 2. Sınavları çek
        const examsSnapshot = await db.collection('exams').get();
        allExams = [];
        approvedExams = [];
        pendingExams = [];
        
        examsSnapshot.forEach(doc => {
            const data = doc.data();
            const exam = { id: doc.id, ...data };
            allExams.push(exam);
            
            if (data.status === 'pending') {
                pendingExams.push(exam);
            } else {
                approvedExams.push(exam);
            }
        });
        
        // Tabloları ve istatistikleri güncelle
        updatePendingTable();
        updateRankingTable();

    } catch (error) {
        console.error("Veri çekme hatası:", error);
        alert("Sistemden veriler çekilirken bir hata oluştu.\nHATA DETAYI: " + error.message);
    }
}

function updatePendingTable() {
    const tbody = document.querySelector("#pendingTable tbody");
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (pendingExams.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-secondary); padding: 1.5rem;">Onay bekleyen sınav bulunmuyor. 🎉</td></tr>';
        return;
    }

    const escapeHTML = (str) => {
        if (!str) return '';
        return String(str).replace(/[&<>'"]/g, tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag]));
    };

    pendingExams.forEach(exam => {
        const tr = document.createElement('tr');
        const studentName = escapeHTML(exam.studentName || exam.studentEmail);
        
        tr.innerHTML = `
            <td>${escapeHTML(exam.date || '')}</td>
            <td>${studentName}</td>
            <td>${escapeHTML(exam.examNumber)}</td>
            <td>${escapeHTML(exam.publisher)}</td>
            <td style="font-weight: bold; color: var(--accent-color);">${exam.totalScore.toFixed(2)}</td>
            <td>
                <div class="flex" style="gap: 0.5rem; justify-content: flex-start;">
                    <button class="btn btn-primary" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;" onclick="approveExam('${exam.id}')">Onayla</button>
                    <button class="btn btn-outline" style="padding: 0.4rem 0.8rem; font-size: 0.85rem; border-color: #ef4444; color: #ef4444;" onclick="rejectExam('${exam.id}')">Reddet</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.approveExam = async function(examId) {
    if(!confirm("Bu sınavı onaylamak istediğinize emin misiniz? Onaylandığında sıralama tablosuna eklenecektir.")) return;
    
    try {
        await db.collection('exams').doc(examId).update({
            status: 'approved'
        });
        loadData(); // Verileri yeniden yükle
    } catch (error) {
        console.error("Onaylama hatası:", error);
        alert("Sınav onaylanırken hata oluştu. Firebase kurallarınızı (update yetkisini) kontrol edin!\n" + error.message);
    }
}

window.rejectExam = async function(examId) {
    if(!confirm("Bu sınavı REDDETMEK ve sistemden KALICI OLARAK SİLMEK istediğinize emin misiniz?")) return;
    
    try {
        await db.collection('exams').doc(examId).delete();
        loadData(); // Verileri yeniden yükle
    } catch (error) {
        console.error("Silme hatası:", error);
        alert("Sınav silinirken hata oluştu. Firebase kurallarınızı (delete yetkisini) kontrol edin!\n" + error.message);
    }
}

function updateRankingTable() {
    const tbody = document.querySelector("#rankingTable tbody");
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const escapeHTML = (str) => {
        if (!str) return '';
        return String(str).replace(/[&<>'"]/g, tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag]));
    };
    
    // Öğrencilerin sınavlarını hesapla (Sadece Onaylılar)
    const studentStats = [];
    allStudents.forEach(student => {
        const studentExams = approvedExams.filter(e => e.studentUid === student.uid);
        const examsCount = studentExams.length;
        let totalSum = 0;
        studentExams.forEach(e => totalSum += e.totalScore);
        const average = examsCount > 0 ? (totalSum / examsCount) : 0;
        
        studentStats.push({
            name: student.name || 'İsimsiz',
            username: student.username || 'bilinmiyor',
            examsCount: examsCount,
            average: average
        });
    });

    // Puanlara göre büyükten küçüğe sırala
    studentStats.sort((a, b) => b.average - a.average);
    
    // Tabloyu doldur
    studentStats.forEach((stat, index) => {
        const tr = document.createElement('tr');
        
        let rankStr = (index + 1).toString();
        if (index === 0 && stat.examsCount > 0) rankStr = '🥇 1';
        if (index === 1 && stat.examsCount > 0) rankStr = '🥈 2';
        if (index === 2 && stat.examsCount > 0) rankStr = '🥉 3';
        
        tr.innerHTML = `
            <td>${rankStr}</td>
            <td>${escapeHTML(stat.name)}</td>
            <td>@${escapeHTML(stat.username)}</td>
            <td>${stat.examsCount}</td>
            <td style="font-weight: bold; color: var(--accent-color);">${stat.average.toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
    });
    
    updateDashboardStats();
}

function updateDashboardStats() {
    document.getElementById('totalStudents').innerText = allStudents.length;
    
    // Benzersiz deneme sayısını (Deneme 1, Deneme 2 vb.) hesapla (Sadece Onaylılar)
    const uniqueExamsSet = new Set(approvedExams.map(e => e.examNumber));
    document.getElementById('totalExamsInSystem').innerText = uniqueExamsSet.size;
    
    let totalScoreSum = 0;
    approvedExams.forEach(e => totalScoreSum += e.totalScore);
    const avg = approvedExams.length > 0 ? (totalScoreSum / approvedExams.length) : 0;
    
    const classAvgEl = document.getElementById('classAverage');
    if (classAvgEl) {
        classAvgEl.innerText = avg.toFixed(2);
    }
}

// Dışa Aktar Fonksiyonu (jsPDF ve jsPDF-AutoTable gerektirir)
window.exportData = function() {
    if (approvedExams.length === 0) {
        alert("Dışa aktarılacak veri bulunamadı.");
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const trMap = {
            'ç':'c', 'Ç':'C', 'ğ':'g', 'Ğ':'G', 'ı':'i', 'İ':'I', 'ö':'o', 'Ö':'O', 'ş':'s', 'Ş':'S', 'ü':'u', 'Ü':'U'
        };
        const normalizeStr = (str) => {
            if(!str) return '';
            return str.replace(/[çÇğĞıİöÖşŞüÜ]/g, match => trMap[match]);
        };

        doc.setFontSize(18);
        doc.text("Sinif Genel Siralama ve Analiz", 14, 22);
        doc.setFontSize(11);
        doc.setTextColor(100);
        
        // Yeniden hesapla (Sadece Onaylılar)
        const studentStats = [];
        allStudents.forEach(student => {
            const studentExams = approvedExams.filter(e => e.studentUid === student.uid);
            const examsCount = studentExams.length;
            let totalSum = 0;
            studentExams.forEach(e => totalSum += e.totalScore);
            studentStats.push({
                name: student.name || 'İsimsiz',
                username: student.username || '',
                examsCount: examsCount,
                average: examsCount > 0 ? (totalSum / examsCount) : 0
            });
        });
        studentStats.sort((a, b) => b.average - a.average);

        const tableColumn = ["Sira", "Ogrenci", "Kullanici Adi", "Girilen Sinav", "Genel Ortalama"];
        const tableRows = [];

        studentStats.forEach((stat, index) => {
            const rowData = [
                (index + 1).toString(),
                normalizeStr(stat.name),
                "@" + normalizeStr(stat.username),
                stat.examsCount.toString(),
                stat.average.toFixed(2)
            ];
            tableRows.push(rowData);
        });

        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 30,
            theme: 'grid',
            headStyles: { fillColor: [59, 130, 246] }
        });

        doc.save(`sinif_analizi_${Date.now()}.pdf`);
    } catch (e) {
        console.error(e);
        alert("PDF oluşturulurken bir hata oluştu. Lütfen sayfayı yenileyip tekrar deneyin.");
    }
}

// Şifre Değiştirme Fonksiyonu
window.changePassword = async function() {
    const user = auth.currentUser;
    if (!user) return alert("Lütfen önce giriş yapın.");

    const newPassword = prompt("Lütfen yeni şifrenizi girin (En az 6 karakter olmalıdır):");
    if (!newPassword) return; // İptal'e basıldı

    if (newPassword.length < 6) {
        return alert("Şifreniz çok zayıf. En az 6 karakter olmalıdır!");
    }

    try {
        await user.updatePassword(newPassword);
        alert("Harika! Şifreniz başarıyla değiştirildi. Bundan sonraki girişlerinizde yeni şifrenizi kullanabilirsiniz.");
    } catch (error) {
        console.error("Şifre değiştirme hatası:", error);
        // Firebase bazen uzun süre açık kalan oturumlarda güvenlik için tekrar giriş ister
        if (error.code === 'auth/requires-recent-login') {
            alert("Güvenlik nedeniyle şifrenizi değiştirmeden önce sistemden 'Çıkış Yap'ıp tekrar giriş yapmanız gerekmektedir.");
        } else {
            alert("Şifre değiştirilirken bir hata oluştu: " + error.message);
        }
    }
}

// --- AKILLI PDF OKUYUCU VE EŞLEŞTİRME (LOCAL) ---

// Levenshtein Mesafe Algoritması
function levenshtein(a, b) {
    const matrix = [];
    let i, j;
    for (i = 0; i <= b.length; i++) matrix[i] = [i];
    for (j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (i = 1; i <= b.length; i++) {
        for (j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
            }
        }
    }
    return matrix[b.length][a.length];
}

// Benzerlik Oranı (Yüzde)
function similarity(s1, s2) {
    let longer = s1, shorter = s2;
    if (s1.length < s2.length) { longer = s2; shorter = s1; }
    let longerLength = longer.length;
    if (longerLength === 0) return 1.0;
    return (longerLength - levenshtein(longer, shorter)) / parseFloat(longerLength);
}

// Türkçe karakter dönüşümü
function normalizeForMatch(str) {
    if (!str) return '';
    return str.toLowerCase()
        .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
        .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
        .replace(/[^a-z0-9]/g, '');
}

window.handlePDFUpload = async function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const btnText = document.getElementById('pdfUploadLabelText');
    const originalText = btnText.innerText;
    btnText.innerText = "Okunuyor...";
    
    try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
        
        const fileReader = new FileReader();
        fileReader.onload = async function() {
            const typedarray = new Uint8Array(this.result);
            const pdf = await pdfjsLib.getDocument(typedarray).promise;
            let fullText = "";
            
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + "\n";
            }
            
            parseTextAndMatch(fullText);
            btnText.innerText = originalText;
            event.target.value = '';
        };
        fileReader.readAsArrayBuffer(file);
    } catch (error) {
        console.error("PDF Okuma Hatası:", error);
        alert("PDF okunamadı. Lütfen geçerli bir PDF dosyası seçin.");
        btnText.innerText = originalText;
    }
}

async function parseTextAndMatch(text) {
    const words = text.split(/\s+/);
    let potentialMatches = [];
    
    for (let i = 0; i < words.length; i++) {
        // Puanı bul (100 ile 500 arası)
        const numMatch = words[i].match(/^([1-5]\d{2}(?:[.,]\d+)?)$/);
        if (numMatch) {
            const score = parseFloat(numMatch[1].replace(',', '.'));
            
            // Kendinden önceki 3 kelimeyi alıp isim kombinasyonları oluştur
            const prev1 = words[i-1] || '';
            const prev2 = words[i-2] || '';
            const prev3 = words[i-3] || '';
            
            const nameCombos = [
                prev2 + " " + prev1,
                prev3 + " " + prev2 + " " + prev1,
                prev1
            ];
            
            allStudents.forEach(student => {
                const normalizedStudentName = normalizeForMatch(student.name);
                const normalizedUsername = normalizeForMatch(student.username);
                
                nameCombos.forEach(combo => {
                    const normalizedCombo = normalizeForMatch(combo);
                    if (normalizedCombo.length < 3) return;
                    
                    const sim1 = similarity(normalizedCombo, normalizedStudentName);
                    const sim2 = similarity(normalizedCombo, normalizedUsername);
                    const maxSim = Math.max(sim1, sim2);
                    
                    if (maxSim > 0.8) { // %80 benzerlik
                        potentialMatches.push({
                            student: student,
                            score: score,
                            similarity: maxSim,
                            combo: combo
                        });
                    }
                });
            });
        }
    }
    
    // Aynı öğrenci için birden fazla eşleşme olduysa en yüksek benzerliği seç
    const finalMatches = {};
    potentialMatches.forEach(match => {
        if (!finalMatches[match.student.uid] || finalMatches[match.student.uid].similarity < match.similarity) {
            finalMatches[match.student.uid] = match;
        }
    });
    
    const matchedArray = Object.values(finalMatches);
    
    if (matchedArray.length === 0) {
        alert("PDF okundu ancak sistemdeki öğrencilerle eşleşen bir not bulunamadı. Lütfen PDF formatını kontrol edin.");
        return;
    }
    
    const confirmMsg = `${matchedArray.length} öğrencinin notu başarıyla eşleştirildi!\nÖrnek: ${matchedArray[0].student.name} -> ${matchedArray[0].score} Puan\n\nBu notlar 'Onay Bekleyen Sınavlar' listesine aktarılsın mı?`;
    
    if (confirm(confirmMsg)) {
        uploadMatchesToFirestore(matchedArray);
    }
}

async function uploadMatchesToFirestore(matches) {
    const examNumber = prompt("Bu denemenin numarası kaç? (Örn: 5)");
    if (!examNumber) return;
    
    const publisher = prompt("Bu denemenin yayın evi nedir? (Örn: Özdebir)");
    if (!publisher) return;
    
    const dateStr = new Date().toLocaleDateString('tr-TR');
    
    const btnText = document.getElementById('pdfUploadLabelText');
    const originalText = btnText.innerText;
    btnText.innerText = "Yükleniyor...";
    
    try {
        const batch = db.batch(); // Toplu işlem (Hız için)
        
        matches.forEach(match => {
            const docRef = db.collection('exams').doc();
            batch.set(docRef, {
                studentUid: match.student.uid,
                studentName: match.student.name || match.student.username,
                studentEmail: match.student.email,
                examNumber: examNumber,
                publisher: publisher,
                date: dateStr,
                status: 'pending',
                totalScore: match.score,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                results: {} // Sadece toplam puan
            });
        });
        
        await batch.commit();
        alert("Harika! Tüm eşleşen notlar 'Onay Bekleyen Sınavlar' listesine aktarıldı. Oradan kontrol edip onaylayabilirsiniz.");
        loadData(); // Sayfayı yenile
    } catch (error) {
        console.error("Toplu yükleme hatası:", error);
        alert("Yükleme sırasında hata oluştu: " + error.message);
    } finally {
        btnText.innerText = originalText;
    }
}
