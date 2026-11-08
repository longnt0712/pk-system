(function () {
    'use strict';
    angular.module('Hrm.TnttDocuments').factory('TnttDocumentLive', ['$window', '$timeout', 'TnttDocumentApi', 'settings', function (window, timeout, api, settings) {
        function uuid() {
            if (window.crypto && window.crypto.randomUUID) { return window.crypto.randomUUID(); }
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (key) { var n = Math.random() * 16 | 0; return (key === 'x' ? n : n & 3 | 8).toString(16); });
        }
        function connect(documentId, changed) {
            var client = {id: uuid(), state: 'connecting', peers: []}, socket = null, closed = false, retry = null, heartbeat = null, cursorTimer = null;
            var delay = 1000, point = null, lastCursor = 0, lastMessage = Date.now(), notifyTimer = null, pendingHint = null, leftEarly = {};
            function notify(revision) {
                if (Number.isInteger(revision)) pendingHint = Math.max(pendingHint || 0, revision);
                if (!notifyTimer) notifyTimer = timeout(function () { notifyTimer = null; var hint = pendingHint; pendingHint = null; if (!closed) changed(hint); }, 16);
            }
            function send(packet) { if (socket && socket.readyState === 1) { socket.send(JSON.stringify(packet)); return true; } return false; }
            function flushCursor() { timeout.cancel(cursorTimer); cursorTimer = null; if (point && client.state === 'online' && send({type: 'cursor', cursor: point})) { lastCursor = Date.now(); } }
            client.cursor = function (cursor) {
                point = cursor;
                if (!cursorTimer) { cursorTimer = timeout(flushCursor, Math.max(0, 80 - (Date.now() - lastCursor)), false); }
            };
            function beat() {
                timeout.cancel(heartbeat);
                if (closed) { return; }
                if (Date.now() - lastMessage > 45000 && socket) { socket.close(); }
                else { send({type: 'ping'}); }
                heartbeat = timeout(beat, 15000, false);
            }
            function reconnect() {
                if (closed) { return; }
                client.state = 'offline'; client.peers = []; notify();
                timeout.cancel(retry); retry = timeout(open, delay, false); delay = Math.min(15000, delay * 2);
            }
            function peer(value) {
                if (!value || typeof value.id !== 'string' || value.id === client.id || typeof value.name !== 'string' || !/^#[a-f0-9]{6}$/i.test(value.color)) { return; }
                client.peers = client.peers.filter(function (row) { return row.id !== value.id; });
                if (client.peers.length < 100) { client.peers.push(value); }
            }
            function open() {
                retry = null;
                if (closed || !window.WebSocket) { client.state = 'unavailable'; return; }
                client.state = 'connecting'; notify();
                leftEarly = {};
                api.liveTicket(documentId, client.id).then(function (ticket) {
                    if (closed) { return; }
                    var url = new window.URL(settings.api.baseUrl + 'public/tntt-document-live', window.location.href);
                    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'; url.searchParams.set('ticket', ticket.ticket);
                    var connection = socket = new window.WebSocket(url.href);
                    heartbeat = timeout(function () { if (socket === connection && client.state !== 'online') connection.close(); }, 10000, false);
                    connection.onmessage = function (event) {
                        if (closed || socket !== connection) { return; }
                        var packet; try { packet = JSON.parse(event.data); } catch (ignore) { return; }
                        lastMessage = Date.now();
                        if (packet.type === 'welcome' && Number(packet.documentId) === Number(documentId) && packet.self && packet.self.id === client.id) {
                            client.state = 'online'; (packet.peers || []).forEach(function (value) { if (!leftEarly[value.id] && !client.peers.some(function (row) { return row.id === value.id; })) peer(value); }); delay = 1000; flushCursor(); beat(); notify(packet.revision);
                        } else if (packet.type === 'cursor' || packet.type === 'join') { if (packet.peer) delete leftEarly[packet.peer.id]; peer(packet.peer); notify(); }
                        else if (packet.type === 'leave') { if (client.state === 'connecting') leftEarly[packet.id] = true; client.peers = client.peers.filter(function (row) { return row.id !== packet.id; }); notify(); }
                        else if (packet.type === 'revision') { notify(packet.revision); }
                        else if (packet.type === 'pong' && Array.isArray(packet.peers)) { client.peers = []; packet.peers.forEach(peer); notify(); }
                    };
                    connection.onclose = function (event) {
                        if (closed || socket !== connection) { return; }
                        socket = null; timeout.cancel(heartbeat); heartbeat = null;
                        if (event.code === 1008 && event.reason !== 'AUTH') { client.state = 'unavailable'; client.peers = []; notify(); }
                        else { reconnect(); }
                    };
                    connection.onerror = angular.noop;
                }).catch(function (error) {
                    if (closed) { return; }
                    if ([400, 401, 403, 404].indexOf(error.status) >= 0) { client.state = 'unavailable'; client.peers = []; notify(); }
                    else { reconnect(); }
                });
            }
            client.close = function () {
                closed = true; timeout.cancel(retry); timeout.cancel(heartbeat); timeout.cancel(cursorTimer); timeout.cancel(notifyTimer);
                client.state = 'closed'; client.peers = [];
                if (socket) { socket.onclose = socket.onmessage = null; socket.close(); socket = null; }
            };
            open(); return client;
        }
        return {connect: connect, uuid: uuid};
    }]);
}());
