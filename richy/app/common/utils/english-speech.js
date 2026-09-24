(function (window, document) {
    'use strict';

    var synthesis = window.speechSynthesis;
    var Utterance = window.SpeechSynthesisUtterance;
    var voices = [];
    var activeUtterance = null;
    var warmUpUtterance = null;
    var pendingTimer = null;
    var requestToken = 0;
    var warmedUp = false;

    function supported() {
        return !!(synthesis && Utterance);
    }

    function refreshVoices() {
        if (!supported()) { return []; }
        try {
            voices = synthesis.getVoices() || [];
        } catch (ignoreVoiceError) {
            voices = [];
        }
        return voices;
    }

    function languageMatches(voice, language, exact) {
        var voiceLanguage = String(voice && voice.lang || '').toLowerCase();
        var requestedLanguage = String(language || 'en-US').toLowerCase();
        return exact
            ? voiceLanguage === requestedLanguage
            : voiceLanguage.indexOf(requestedLanguage.substring(0, 2)) === 0;
    }

    function selectVoice(language, preferredName) {
        var available = refreshVoices();
        var index;
        if (preferredName) {
            for (index = 0; index < available.length; index += 1) {
                if (available[index] && available[index].name === preferredName
                        && languageMatches(available[index], language, false)) {
                    return available[index];
                }
            }
        }
        for (index = 0; index < available.length; index += 1) {
            if (languageMatches(available[index], language, true)) { return available[index]; }
        }
        for (index = 0; index < available.length; index += 1) {
            if (languageMatches(available[index], language, false)) { return available[index]; }
        }
        return null;
    }

    function plainText(value) {
        var container;
        if (value == null) { return ''; }
        container = document.createElement('div');
        container.innerHTML = String(value);
        return String(container.textContent || container.innerText || '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function speechText(value) {
        var text = plainText(value);
        var wordCount;
        if (!text) { return ''; }
        wordCount = text.split(/\s+/).length;
        if (wordCount <= 2 && text.length <= 16) {
            /* A leading pause prevents Chrome from clipping the first phoneme of short words such as "I". */
            return ', ' + text + (/[.!?]$/.test(text) ? '' : '.');
        }
        return text;
    }

    function clearPending() {
        if (pendingTimer !== null) {
            window.clearTimeout(pendingTimer);
            pendingTimer = null;
        }
    }

    function cancel() {
        requestToken += 1;
        clearPending();
        activeUtterance = null;
        try {
            if (synthesis) { synthesis.cancel(); }
        } catch (ignoreCancelError) {
            // Speech failure must never interrupt a lesson or a game.
        }
    }

    function speak(value, options) {
        var text;
        var token;
        var hadQueuedSpeech;
        var delay;
        options = options || {};
        if (!supported()) { return false; }
        text = speechText(value);
        if (!text) { return false; }

        requestToken += 1;
        token = requestToken;
        clearPending();
        hadQueuedSpeech = synthesis.speaking || synthesis.pending || !!activeUtterance;

        if (options.interrupt !== false && hadQueuedSpeech) {
            try { synthesis.cancel(); } catch (ignoreCancelError) {}
            activeUtterance = null;
        }

        delay = options.delay;
        if (delay == null) { delay = options.interrupt !== false && hadQueuedSpeech ? 120 : 20; }
        pendingTimer = window.setTimeout(function () {
            var utterance;
            var selectedVoice;
            if (token !== requestToken) { return; }
            pendingTimer = null;
            utterance = new Utterance(text);
            utterance.lang = options.lang || 'en-US';
            utterance.rate = options.rate == null ? 0.95 : Number(options.rate);
            utterance.pitch = options.pitch == null ? 1 : Number(options.pitch);
            utterance.volume = options.volume == null ? 1 : Number(options.volume);
            selectedVoice = selectVoice(utterance.lang, options.voiceName);
            if (selectedVoice) { utterance.voice = selectedVoice; }
            utterance.onend = function (event) {
                if (activeUtterance === utterance) { activeUtterance = null; }
                if (typeof options.onend === 'function') { options.onend(event); }
            };
            utterance.onerror = function (event) {
                if (activeUtterance === utterance) { activeUtterance = null; }
                if (typeof options.onerror === 'function') { options.onerror(event); }
            };
            activeUtterance = utterance;
            try {
                synthesis.resume();
                synthesis.speak(utterance);
            } catch (ignoreSpeakError) {
                activeUtterance = null;
                return false;
            }
            return true;
        }, Math.max(0, Number(delay) || 0));
        return true;
    }

    function warmUp() {
        var voice;
        if (warmedUp || !supported()) { return; }
        warmedUp = true;
        refreshVoices();
        try {
            warmUpUtterance = new Utterance('.');
            warmUpUtterance.lang = 'en-US';
            warmUpUtterance.volume = 0;
            warmUpUtterance.rate = 2;
            voice = selectVoice('en-US');
            if (voice) { warmUpUtterance.voice = voice; }
            warmUpUtterance.onend = function () { warmUpUtterance = null; };
            synthesis.speak(warmUpUtterance);
        } catch (ignoreWarmUpError) {
            warmUpUtterance = null;
        }
        document.removeEventListener('pointerdown', warmUp, true);
        document.removeEventListener('touchstart', warmUp, true);
        document.removeEventListener('keydown', warmUp, true);
    }

    if (supported()) {
        refreshVoices();
        if (synthesis.addEventListener) {
            synthesis.addEventListener('voiceschanged', refreshVoices);
        }
        document.addEventListener('pointerdown', warmUp, true);
        document.addEventListener('touchstart', warmUp, true);
        document.addEventListener('keydown', warmUp, true);
    }

    window.EnglishSpeech = {
        isSupported: supported,
        refreshVoices: refreshVoices,
        speak: speak,
        cancel: cancel,
        resume: function () {
            try { if (synthesis) { synthesis.resume(); } } catch (ignoreResumeError) {}
        },
        warmUp: warmUp
    };
})(window, document);
