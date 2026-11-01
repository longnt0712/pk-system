(function () {
    'use strict';
    Hrm.run(['$rootScope', '$window', function (root, win) {
        var tntt = /^(www\.)?tnttphungkhoang\.com$/i.test(win.location.hostname);
        var brand = tntt ? 'TNTT Phùng Khoang' : 'IELTS Room';
        var homeTitle = tntt ? 'TNTT Phùng Khoang | Thiếu Nhi Thánh Thể Phùng Khoang'
            : 'IELTS Room | Luyện IELTS và tiếng Anh online';
        var home = tntt ? 'https://tnttphungkhoang.com/' : 'https://ieltsroom.com/';
        root.$on('$stateChangeSuccess', function (event, state) {
            var isHome = state.name === 'login';
            win.document.title = isHome ? homeTitle : brand + ' | ' + ((state.data || {}).pageTitle || 'Học tập và sinh hoạt');
            var robots = win.document.querySelector('meta[name="robots"]');
            if (robots) robots.content = isHome ? 'index, follow, max-image-preview:large' : 'noindex, nofollow';
            var canonical = win.document.getElementById('site-canonical');
            if (isHome) {
                if (!canonical) {
                    canonical = win.document.createElement('link');
                    canonical.id = 'site-canonical'; canonical.rel = 'canonical';
                    win.document.head.appendChild(canonical);
                }
                canonical.href = home;
            } else if (canonical) { canonical.parentNode.removeChild(canonical); }
        });
    }]);
})();
