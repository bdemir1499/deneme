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
        
        // Tabloyu ve istatistikleri güncelle
        updateRankingTable();

    } catch (error) {
        console.error("Veri çekme hatası:", error);
        alert("Sistemden veriler çekilirken bir hata oluştu.\nHATA DETAYI: " + error.message);
    }
}

function updateRankingTable() {
    const tbody = document.querySelector("#rankingTable tbody");
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
    
    // Öğrencilerin sınavlarını hesapla
    const studentStats = [];
    allStudents.forEach(student => {
        const studentExams = allExams.filter(e => e.studentUid === student.uid);
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
    
    // Benzersiz deneme sayısını (Deneme 1, Deneme 2 vb.) hesapla
    const uniqueExamsSet = new Set(allExams.map(e => e.examNumber));
    document.getElementById('totalExamsInSystem').innerText = uniqueExamsSet.size;
    
    let totalScoreSum = 0;
    allExams.forEach(e => totalScoreSum += e.totalScore);
    const avg = allExams.length > 0 ? (totalScoreSum / allExams.length) : 0;
    
    const classAvgEl = document.getElementById('classAverage');
    if (classAvgEl) {
        classAvgEl.innerText = avg.toFixed(2);
    }
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
        
        // Yeniden hesapla
        const studentStats = [];
        allStudents.forEach(student => {
            const studentExams = allExams.filter(e => e.studentUid === student.uid);
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
