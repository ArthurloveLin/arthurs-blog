document.addEventListener('DOMContentLoaded', () => {
  const albums = document.querySelectorAll('.album');

  albums.forEach(album => {
    const coverUrl = album.getAttribute('data-cover-url');
    const vinylCover = album.querySelector('.vinyl-cover');

    if (coverUrl && vinylCover) {
      vinylCover.style.backgroundImage = `url('${coverUrl}')`;
    }
  });
});
