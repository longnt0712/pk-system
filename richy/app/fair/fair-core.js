(function (root, factory) {
    'use strict';
    if (typeof module === 'object' && module.exports) { module.exports = factory(); }
    else { root.FairCore = factory(); }
})(typeof window !== 'undefined' ? window : this, function () {
    'use strict';
    function cardCode(value) {
        var code = String(value || '').trim();
        if (/^https?:\/\//i.test(code)) {
            var link;
            try { link = new URL(code); } catch (error) { throw Error('Đường link trên thẻ không hợp lệ.'); }
            code = link.searchParams.get('ma') || link.searchParams.get('cardCode') || link.searchParams.get('studentCode') || '';
        }
        if (!code || code.length > 100 || !/^[\p{L}\p{N}_.@-]+$/u.test(code)) { throw Error('Hãy quét mã QR trên thẻ hoặc nhập đúng mã thẻ.'); }
        return code;
    }
    function key(crypto) {
        var bytes = new Uint8Array(16);
        if (!crypto || !crypto.getRandomValues) { throw Error('Hãy mở trang bằng HTTPS để thực hiện giao dịch.'); }
        crypto.getRandomValues(bytes); bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
        var hex = Array.from(bytes, function (value) { return ('0' + value.toString(16)).slice(-2); }).join('');
        return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
    }
    function tiers(event) {
        return [
            {key: 'EASY', name: 'Dễ', amount: event.easyAmount},
            {key: 'MEDIUM', name: 'Trung bình', amount: event.mediumAmount},
            {key: 'HARD', name: 'Khó', amount: event.hardAmount}
        ];
    }
    function uncertain(error) { return !error || typeof error.status !== 'number' || error.status <= 0 || error.status >= 500 || error.status === 408 || error.status === 429; }
    return {cardCode: cardCode, key: key, tiers: tiers, uncertain: uncertain};
});
