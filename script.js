document.addEventListener("DOMContentLoaded", function () {

  const video = document.querySelector(".Box video");

  // video tapılmazsa xeta vermesin
  if (video) {
    video.playbackRate = 1.0; // videonun sürəti
  }

  // Sadə, aydın görünən yuxarı-aşağı fon animasiyası
  let pos = 50;          // Başlanğıc mövqe (orta)
  let direction = 1;     // 1 = aşağı, -1 = yuxarı
  const minPos = 35;     // Yuxarı limit (faizlə) - daha geniş hərəkət
  const maxPos = 65;     // Aşağı limit (faizlə) - daha geniş hərəkət
  const speed = 0.06;    // Hərəkət sürəti (böyük rəqəm = daha sürətli) - yavaş

  function animateBackground() {
    pos += direction * speed;

    // Limitlərə çatanda istiqaməti dəyiş
    if (pos >= maxPos) {
      pos = maxPos;
      direction = -1;
    }
    if (pos <= minPos) {
      pos = minPos;
      direction = 1;
    }

    // Fon mövqeyini tətbiq et (həm body, həm də ::before pseudo-element üçün CSS variable ilə)
    document.body.style.backgroundPosition = `50% ${pos}%`;
    document.documentElement.style.setProperty('--bg-pos', `${pos}%`);

    requestAnimationFrame(animateBackground);
  }

  // Animasiya başlasın
  requestAnimationFrame(animateBackground);

});

document.querySelectorAll('.Button button').forEach(btn => {
    btn.addEventListener('click', () => {

        document.querySelectorAll('.Button button').forEach(b => {
            b.classList.remove('active');
        });

        btn.classList.add('active');
    });
});



