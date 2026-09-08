let examChart;

// Sayfa yüklendiğinde oturum kontrolü yap
document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            // Firestore'dan rolü kontrol et
            db.collection('users').doc(user.uid).get().then(doc => {
                if (doc.exists && doc.data().role !== 'student') {
                    window.location.href = 'teacher.html';
                } else {
                    // Kullanıcı adı yazdır
                    document.getElementById('userNameDisplay').innerText = doc.data().name || doc.data().username;
                    // Öğrencinin verilerini yükle
                    loadStudentData(user.uid);
                }
            });
        }
    });

    // Formu dinle
    const addExamForm = document.getElementById('addExamForm');
    if (addExamForm) {
        addExamForm.addEventListener('submit', saveExam);
    }

    attachNetCalculators();
});

async function loadStudentData(uid) {
    try {
        const snapshot = await db.collection('exams')
            .where('studentUid', '==', uid)
            .get();
        
        let exams = [];
        snapshot.forEach(doc => {
            exams.push({ id: doc.id, ...doc.data() });
        });
        
        // Numaraya göre sırala
        exams.sort((a, b) => parseInt(a.examNumber) - parseInt(b.examNumber));

        updateTable(exams);
        updateChart(exams);
        updateDashboard(exams);
    } catch (error) {
        console.error("Veri çekme hatası:", error);
    }
}

function calculateNet(correct, wrong) {
    const c = parseFloat(correct) || 0;
    const w = parseFloat(wrong) || 0;
    // 3 yanlış 1 doğruyu götürür
    const net = c - (w / 3);
    return Math.max(0, net).toFixed(2);
}

function attachNetCalculators() {
    const subjects = [
        { prefix: 'turkce' },
        { prefix: 'mat' },
        { prefix: 'fen' },
        { prefix: 'sos' },
        { prefix: 'ingilizce' },
        { prefix: 'din' }
    ];
    
    subjects.forEach(sub => {
        const cInput = document.getElementById(`${sub.prefix}_d`);
        const wInput = document.getElementById(`${sub.prefix}_y`);
        const nInput = document.getElementById(`${sub.prefix}_n`);
        
        if (cInput && wInput && nInput) {
            const updateNet = () => {
                nInput.value = calculateNet(cInput.value, wInput.value);
            };
            cInput.addEventListener('input', updateNet);
            wInput.addEventListener('input', updateNet);
        }
    });
}

async function saveExam(e) {
    e.preventDefault(); // Sayfanın yenilenmesini engelle

    const user = auth.currentUser;
    if (!user) return alert("Lütfen önce giriş yapın.");

    const btn = document.querySelector('#addExamForm button[type="submit"]');
    const originalText = btn.innerText;
    btn.innerText = "Kaydediliyor...";
    btn.disabled = true;

    try {
        // Öğrenci adını çek
        const userDoc = await db.collection('users').doc(user.uid).get();
        const studentName = userDoc.data().name || userDoc.data().username;

        const dateStr = new Date().toLocaleDateString('tr-TR'); // Bugünün tarihi

        const examData = {
            studentUid: user.uid,
            studentName: studentName,
            studentEmail: user.email,
            examNumber: document.getElementById('examNumber').value,
            publisher: document.getElementById('publisher').value,
            date: dateStr,
            totalScore: parseFloat(document.getElementById('totalScore').value),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            results: {
                turkish: {
                    correct: document.getElementById('turkce_d').value,
                    wrong: document.getElementById('turkce_y').value,
                    net: document.getElementById('turkce_n').value
                },
                math: {
                    correct: document.getElementById('mat_d').value,
                    wrong: document.getElementById('mat_y').value,
                    net: document.getElementById('mat_n').value
                },
                science: {
                    correct: document.getElementById('fen_d').value,
                    wrong: document.getElementById('fen_y').value,
                    net: document.getElementById('fen_n').value
                },
                social: {
                    correct: document.getElementById('sos_d').value,
                    wrong: document.getElementById('sos_y').value,
                    net: document.getElementById('sos_n').value
                },
                english: {
                    correct: document.getElementById('ingilizce_d').value,
                    wrong: document.getElementById('ingilizce_y').value,
                    net: document.getElementById('ingilizce_n').value
                },
                religion: {
                    correct: document.getElementById('din_d').value,
                    wrong: document.getElementById('din_y').value,
                    net: document.getElementById('din_n').value
                }
            }
        };

        if (!examData.examNumber || !examData.publisher || isNaN(examData.totalScore)) {
            alert("Lütfen zorunlu alanları doldurun.");
            btn.innerText = originalText;
            btn.disabled = false;
            return;
        }

        // KULLANICI ONAYI (KVKK ve Güvenlik kuralları gereği silinemeyeceği için)
        const isConfirmed = confirm("DİKKAT: Sistemin güvenliği gereği, deneme sonuçlarınızı kaydettikten sonra bir daha değiştiremez veya silemezsiniz!\n\nLütfen girdiğiniz doğru/yanlış sayılarını ve toplam puanınızı tekrar kontrol edin. Kaydetmek istediğinize emin misiniz?");
        
        if (!isConfirmed) {
            btn.innerText = originalText;
            btn.disabled = false;
            return;
        }

        // Firestore'a kaydet
        await db.collection('exams').add(examData);

        alert("Deneme başarıyla kaydedildi!");
        
        // Formu temizle
        document.getElementById('addExamForm').reset();
        
        // Verileri tekrar yükle
        loadStudentData(user.uid);
        
    } catch (error) {
        console.error("Kaydetme hatası:", error);
        alert("Kaydedilirken hata oluştu: " + error.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

function updateTable(exams) {
    const tbody = document.querySelector("#examsTable tbody");
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Son girilen en üstte görünsün diye ters çevir
    const reversedExams = [...exams].reverse();
    
    reversedExams.forEach(exam => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${exam.examNumber}</td>
            <td>${exam.publisher}</td>
            <td>${exam.date}</td>
            <td style="font-weight: bold; color: var(--accent-color);">${exam.totalScore.toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function updateDashboard(exams) {
    document.getElementById('totalExams').innerText = exams.length;
    
    if (exams.length > 0) {
        let total = 0;
        exams.forEach(e => total += e.totalScore);
        document.getElementById('averageScore').innerText = (total / exams.length).toFixed(2);
        
        const lastExam = exams[exams.length - 1]; // Numaraya göre sonuncu
        document.getElementById('lastExamScore').innerText = lastExam.totalScore.toFixed(2);
        document.getElementById('lastExamName').innerText = `${lastExam.publisher} (${lastExam.examNumber}. Deneme)`;
    } else {
        document.getElementById('averageScore').innerText = '-';
        document.getElementById('lastExamScore').innerText = '-';
        document.getElementById('lastExamName').innerText = 'Henüz veri yok';
    }
}

function updateChart(exams) {
    const ctxElement = document.getElementById('progressChart');
    if (!ctxElement) return;
    const ctx = ctxElement.getContext('2d');
    
    const labels = exams.map(e => `${e.examNumber}. Deneme`);
    const data = exams.map(e => e.totalScore);
    
    if (examChart) {
        examChart.destroy();
    }
    
    examChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Deneme Puanı',
                data: data,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#10b981',
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    suggestedMin: 200,
                    suggestedMax: 500,
                    beginAtZero: false,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            },
            plugins: {
                legend: {
                    labels: { color: '#f8fafc' }
                }
            }
        }
    });
}
