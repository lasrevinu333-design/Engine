(function () {
  const base = new URL('.', window.location.href);
  window.MEMPHIS_AVATAR = new URL('memphis_avatar.png', base).toString();
})();
