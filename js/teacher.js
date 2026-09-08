let allExams = [];
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
        examsSnapshot.forEach(doc => {
            allExams.push({ id: doc.id, ...doc.data() });
        });

        // Önce filtreleri (Deneme No dropdown) doldur
        populateFilters();
        
        // Tabloyu ve istatistikleri güncelle
        updateRankingTable();

    } catch (error) {
        console.error("Veri çekme hatası:", error);
        alert("Sistemden veriler çekilirken bir hata oluştu.\nHATA DETAYI: " + error.message);
    }
}

function populateFilters() {
    const filterSelect = document.getElementById('filterExam');
    // Mevcut seçenekleri temizle (Tümü hariç)
    filterSelect.innerHTML = '<option value="all">Tüm Denemeler</option>';
    
    // Benzersiz deneme numaralarını bul
    const uniqueExams = [...new Set(allExams.map(e => parseInt(e.examNumber)))].sort((a,b) => a - b);
    
    uniqueExams.forEach(num => {
        if (!isNaN(num)) {
            const opt = document.createElement('option');
            opt.value = num;
            opt.innerText = `${num}. Deneme`;
            filterSelect.appendChild(opt);
        }
    });
}

function updateRankingTable() {
    const filterVal = document.getElementById('filterExam').value;
    const tbody = document.querySelector("#rankingTable tbody");
    tbody.innerHTML = '';
    
    let filteredExams = allExams;
    
    if (filterVal !== 'all') {
        filteredExams = allExams.filter(e => parseInt(e.examNumber) === parseInt(filterVal));
    }
    
    // Aynı öğrencinin aynı denemede birden fazla kaydı varsa, en yüksek puanlıyı alalım (opsiyonel mantık, ama en mantıklısı bu)
    // XSS Koruması için HTML etiketlerini temizleme fonksiyonu
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
    
    // Puanlara göre büyükten küçüğe sırala
    filteredExams.sort((a, b) => b.totalScore - a.totalScore);
    
    // Tabloyu doldur
    filteredExams.forEach((exam, index) => {
        const tr = document.createElement('tr');
        // İlk 3'e madalya koy
        let rankStr = (index + 1).toString();
        if (index === 0) rankStr = '🥇 1';
        if (index === 1) rankStr = '🥈 2';
        if (index === 2) rankStr = '🥉 3';
        
        const safeStudentName = escapeHTML(exam.studentName || exam.studentEmail);
        const safePublisher = escapeHTML(exam.publisher);
        
        tr.innerHTML = `
            <td>${rankStr}</td>
            <td>${safeStudentName}</td>
            <td>${exam.examNumber}</td>
            <td>${safePublisher}</td>
            <td style="font-weight: bold; color: var(--accent-color);">${exam.totalScore.toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
    });
    
    // Üst kısımdaki istatistikleri güncelle
    updateDashboardStats();
}

function updateDashboardStats() {
    const uniqueStudentsSet = new Set(allExams.map(e => e.studentUid));
    const uniqueExamsSet = new Set(allExams.map(e => e.examNumber));
    
    document.getElementById('totalStudents').innerText = uniqueStudentsSet.size;
    document.getElementById('totalExams').innerText = uniqueExamsSet.size;
    
    let totalScoreSum = 0;
    allExams.forEach(e => totalScoreSum += e.totalScore);
    const avg = allExams.length > 0 ? (totalScoreSum / allExams.length) : 0;
    document.getElementById('averageScore').innerText = avg.toFixed(2);
}

// Dışa Aktar Fonksiyonu (jsPDF ve jsPDF-AutoTable gerektirir)
window.exportData = function() {
    if (allExams.length === 0) {
        alert("Dışa aktarılacak veri bulunamadı.");
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Türkçe karakter desteği için varsayılan fontları ayarla (jsPDF'in standart fontları TR tam desteklemez, ama en iyi çözüm helvetica'dır veya ASCII dönüştürmektir)
        // Basit bir harf dönüşümü yapalım:
        const trMap = {
            'ç':'c', 'Ç':'C', 'ğ':'g', 'Ğ':'G', 'ı':'i', 'İ':'I', 'ö':'o', 'Ö':'O', 'ş':'s', 'Ş':'S', 'ü':'u', 'Ü':'U'
        };
        const normalizeStr = (str) => {
            if(!str) return '';
            return str.replace(/[çÇğĞıİöÖşŞüÜ]/g, match => trMap[match]);
        };

        const filterVal = document.getElementById('filterExam').value;
        const titleText = filterVal === 'all' ? "Tum Deneme Sonuclari" : normalizeStr(filterVal + ". Deneme Sonuclari");
        
        doc.setFontSize(18);
        doc.text(titleText, 14, 22);
        doc.setFontSize(11);
        doc.setTextColor(100);
        
        let filteredExams = allExams;
        if (filterVal !== 'all') {
            filteredExams = allExams.filter(e => parseInt(e.examNumber) === parseInt(filterVal));
        }
        filteredExams.sort((a, b) => b.totalScore - a.totalScore);

        const tableColumn = ["Sira", "Ogrenci", "Deneme No", "Yayin", "Puan"];
        const tableRows = [];

        filteredExams.forEach((exam, index) => {
            const rowData = [
                (index + 1).toString(),
                normalizeStr(exam.studentName || exam.studentEmail),
                exam.examNumber.toString(),
                normalizeStr(exam.publisher),
                exam.totalScore.toFixed(2)
            ];
            tableRows.push(rowData);
        });

        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 30,
            theme: 'grid',
            headStyles: { fillColor: [59, 130, 246] },
            didParseCell: function(data) {
                // Her hücredeki olası utf-8 karakterleri son kez kontrol et
                if (typeof data.cell.text[0] === 'string') {
                   data.cell.text[0] = normalizeStr(data.cell.text[0]);
                }
            }
        });

        doc.save(`sinav_sonuclari_${Date.now()}.pdf`);
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
