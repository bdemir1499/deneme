"use strict";
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
                // GİZLİ KURUCU MODU (Sadece şifreyi ve kullanıcı adını tam bilenler yeni öğretmen ekleyebilir)
                if (role === 'teacher' && rawUsername === 'yonetim' && password === 'kurucu2026') {
                    const newUsername = prompt("Gizli Kurucu Modu: Yeni öğretmenin 'Kullanıcı Adı' ne olsun?");
                    if (!newUsername) throw new Error("İptal edildi.");
                    
                    const newPassword = prompt(`'${newUsername}' için şifre belirleyin (En az 6 karakter):`);
                    if (!newPassword || newPassword.length < 6) throw new Error("Şifre çok kısa veya iptal edildi.");
                    
                    const newEmail = newUsername.toLowerCase() + window.FAKE_DOMAIN;
                    const userCredential = await auth.createUserWithEmailAndPassword(newEmail, newPassword);
                    
                    await db.collection('users').doc(userCredential.user.uid).set({
                        uid: userCredential.user.uid,
                        name: newUsername,
                        username: newUsername.toLowerCase(),
                        email: newEmail,
                        role: 'teacher',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                    alert(`BAŞARILI! '${newUsername}' adında yeni bir öğretmen hesabı oluşturuldu.\nŞimdi bu yeni bilgilerle giriş yapabilirsiniz.`);
                    btn.innerText = originalText;
                    btn.disabled = false;
                    window.isFormSubmitting = false;
                    return; // Normal işleme devam etme, burada dur.
                }

                if (isRegisterMode) {
                    // YENİ KAYIT (Öğrenci)
                    // Güçlü şifre kontrolü: En az 8 karakter, 1 harf, 1 rakam
                    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
                    if (!passwordRegex.test(password)) {
                        alert("GÜVENLİK UYARISI:\nŞifreniz çok zayıf! Lütfen en az 8 karakterden oluşan ve içinde hem HARF hem de RAKAM bulunan daha güçlü bir şifre belirleyin.");
                        throw new Error("Şifre zayıf.");
                    }

                    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                    const user = userCredential.user;
                    
                    await db.collection('users').doc(user.uid).set({
                        uid: user.uid,
                        name: rawUsername, 
                        username: rawUsername, 
                        email: email,
                        role: role,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                } else {
                    // GİRİŞ YAP (Öğrenci veya var olan Öğretmen)
                    await auth.signInWithEmailAndPassword(email, password);
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
                if (error.message === "İptal edildi." || error.message === "Şifre çok kısa veya iptal edildi.") {
                    alert(error.message);
                } else if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.code === 'auth/invalid-login-credentials') {
                    if (!isRegisterMode) {
                        alert("Giriş Hatası: Kullanıcı adı veya şifre hatalı.");
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
