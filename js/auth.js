document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    
    // Oturum durumunu dinle (zaten giriş yapmışsa otomatik yönlendir)
    auth.onAuthStateChanged(user => {
        if (user && !window.isFormSubmitting) {
            // Sadece form gönderilmiyorken (sayfa yeni açıldığında) otomatik yönlendir
            db.collection('users').doc(user.uid).get().then(doc => {
                if (doc.exists) {
                    const role = doc.data().role;
                    if (role === 'teacher' && !window.location.pathname.includes('teacher.html')) {
                        window.location.href = 'teacher.html';
                    } else if (role === 'student' && !window.location.pathname.includes('student.html')) {
                        window.location.href = 'student.html';
                    }
                }
            }).catch(err => {
                console.error("Rol okuma hatası:", err);
            });
        }
    });

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            window.isFormSubmitting = true; // Yarış durumunu engellemek için bayrak
            
            const btn = loginForm.querySelector('button');
            const originalText = btn.innerText;
            btn.innerText = "İşlem Yapılıyor...";
            btn.disabled = true;
            
            // Kullanıcı adını küçük harfe çevirip boşlukları temizliyoruz ki büyük/küçük harf hatası olmasın
            const rawUsername = document.getElementById('email').value.trim().toLowerCase();
            const password = document.getElementById('password').value;
            const role = document.getElementById('loginRole').value;
            
            // Firebase Auth için sahte e-posta formatı
            const email = rawUsername + window.FAKE_DOMAIN;
            
            // Kayıt modunda mıyız?
            const isRegisterMode = !document.getElementById('registerFields').classList.contains('hidden');
            
            try {
                if (isRegisterMode) {
                    // YENİ KAYIT (Öğrenci)
                    // KVKK gereği ad soyad kaldırıldı.
                    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                    const user = userCredential.user;
                    
                    // Firestore'a profili kaydet
                    await db.collection('users').doc(user.uid).set({
                        uid: user.uid,
                        name: rawUsername, 
                        username: rawUsername, 
                        email: email,
                        role: role,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                } else {
                    // GİRİŞ YAP
                    try {
                        await auth.signInWithEmailAndPassword(email, password);
                    } catch (signInError) {
                        // Eğer giren kişi Öğretmen ise ve hesap yoksa, ona özel hesap oluşturma hakkı verelim
                        if (role === 'teacher' && (signInError.code === 'auth/user-not-found' || signInError.code === 'auth/invalid-credential' || signInError.code === 'auth/invalid-login-credentials')) {
                            const isConfirmed = confirm(`Sistemde '${rawUsername}' adında bir öğretmen hesabı bulunamadı.\n\nBu isimle YENİ BİR ÖĞRETMEN HESABI oluşturmak istiyor musunuz?`);
                            
                            if (isConfirmed) {
                                // Öğrenciler öğretmen hesabı açamasın diye ufak bir güvenlik şifresi koyalım
                                const pin = prompt("Öğretmen hesabı oluşturmak için lütfen Kurucu PIN Kodunu girin:");
                                if (pin === "1453") {
                                    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                                    await db.collection('users').doc(userCredential.user.uid).set({
                                        uid: userCredential.user.uid,
                                        name: rawUsername,
                                        username: rawUsername,
                                        email: email,
                                        role: 'teacher',
                                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                                    });
                                    alert("Öğretmen hesabınız başarıyla oluşturuldu!");
                                } else {
                                    throw new Error("PIN Kodu Hatalı! Öğretmen hesabı oluşturulamaz.");
                                }
                            } else {
                                throw signInError; // İptale basarsa normal hatayı fırlat
                            }
                        } else {
                            throw signInError; // Öğrenciyse veya başka hataysa normal hatayı fırlat
                        }
                    }
                }
                
                // İşlem (Kayıt veya Giriş) tamamen bittikten sonra yönlendirmeyi yapıyoruz
                const user = auth.currentUser;
                const doc = await db.collection('users').doc(user.uid).get();
                if (doc.exists) {
                    const finalRole = doc.data().role;
                    window.location.href = finalRole === 'teacher' ? 'teacher.html' : 'student.html';
                } else {
                    alert("Kullanıcı profili bulunamadı!");
                    btn.innerText = originalText;
                    btn.disabled = false;
                    window.isFormSubmitting = false;
                }
                
            } catch (error) {
                if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.code === 'auth/invalid-login-credentials') {
                    if (!isRegisterMode) {
                        alert("Giriş Hatası: Kullanıcı adı veya şifre hatalı. (Hesabınız yoksa önce Kayıt Olun)");
                    } else {
                        alert("Kayıt Hatası: Bu isimde bir kullanıcı zaten olabilir veya şifre geçersiz.");
                    }
                } else if (error.code === 'auth/email-already-in-use') {
                    alert("Kayıt Hatası: Bu kullanıcı adıyla zaten bir hesap var!");
                } else if (error.code === 'auth/weak-password') {
                    alert("Şifreniz çok zayıf. En az 6 karakter olmalıdır.");
                } else if (error.message !== "İsim boş.") {
                    alert("Hata: " + error.message);
                }
                btn.innerText = originalText;
                btn.disabled = false;
                window.isFormSubmitting = false;
            }
        });
    }
});

// Modal Kontrolleri
window.openLoginModal = function(role) {
    document.getElementById('loginModal').classList.add('active');
    document.getElementById('loginRole').value = role;
    if (role === 'student') {
        document.getElementById('modalTitle').innerText = 'Öğrenci Girişi';
        document.getElementById('studentRegisterHint').classList.remove('hidden');
    } else {
        document.getElementById('modalTitle').innerText = 'Öğretmen Girişi';
        document.getElementById('studentRegisterHint').classList.add('hidden');
        document.getElementById('registerFields').classList.add('hidden');
        document.getElementById('submitBtn').querySelector('span').innerText = 'Giriş Yap';
    }
}

window.closeLoginModal = function() {
    document.getElementById('loginModal').classList.remove('active');
}

window.toggleRegister = function() {
    const fields = document.getElementById('registerFields');
    const btn = document.getElementById('submitBtn').querySelector('span');
    const title = document.getElementById('modalTitle');
    const hint = document.getElementById('studentRegisterHint');

    if (fields.classList.contains('hidden')) {
        fields.classList.remove('hidden');
        btn.innerText = 'Kayıt İşlemini Tamamla';
        title.innerText = 'Yeni Kayıt Oluştur';
        hint.innerHTML = 'Zaten hesabınız var mı? <a href="#" onclick="toggleRegister()" style="color: var(--accent-color); text-decoration: none;">Giriş Yapın</a>';
    } else {
        fields.classList.add('hidden');
        btn.innerText = 'Giriş Yap';
        title.innerText = 'Öğrenci Girişi';
        hint.innerHTML = 'Hesabınız yok mu? <a href="#" onclick="toggleRegister()" style="color: var(--accent-color); text-decoration: none;">Kayıt Olun</a>';
    }
}

window.logout = function() {
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    }).catch(error => {
        console.error("Çıkış hatası:", error);
    });
};
