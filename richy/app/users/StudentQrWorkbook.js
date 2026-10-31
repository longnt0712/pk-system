(function (window) {
    'use strict';
    var spreadsheetNs = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    var relationshipNs = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    var packageNs = 'http://schemas.openxmlformats.org/package/2006/relationships';
    var drawingType = relationshipNs + '/drawing';
    var imageType = relationshipNs + '/image';
    var drawingContentType = 'application/vnd.openxmlformats-officedocument.drawing+xml';

    // Embed PNG drawings like the reference workbook: one image anchored to each QR cell.
    // Codes stay in their own text column; images never depend on an external URL.
    function withImages(xlsx, workbook, images) {
        var bytes = xlsx.write(workbook, {type: 'array', bookType: 'xlsx'});
        if (!images.length) { return bytes; }
        var cfb = xlsx.CFB;
        if (!cfb || !cfb.utils) { throw new Error('Thư viện Excel chưa hỗ trợ ảnh QR. Vui lòng tải lại trang.'); }
        var zip = cfb.read(new Uint8Array(bytes), {type: 'buffer'});
        var encoder = new window.TextEncoder(), decoder = new window.TextDecoder('utf-8');
        var parser = new window.DOMParser(), serializer = new window.XMLSerializer();
        function readXml(name) {
            var entry = cfb.find(zip, '/' + name);
            if (!entry) { throw new Error('Không đọc được cấu trúc file Excel.'); }
            var xml = parser.parseFromString(decoder.decode(new Uint8Array(entry.content)), 'application/xml');
            if (xml.getElementsByTagName('parsererror').length) { throw new Error('Cấu trúc file Excel không hợp lệ.'); }
            return xml;
        }
        function addXml(name, xml) { cfb.utils.cfb_add(zip, name, encoder.encode(serializer.serializeToString(xml))); }
        function child(doc, parent, ns, name, attrs) {
            var node = doc.createElementNS(ns, name);
            Object.keys(attrs || {}).forEach(function (key) { node.setAttribute(key, attrs[key]); });
            parent.appendChild(node); return node;
        }
        var sheet = readXml('xl/worksheets/sheet1.xml');
        var drawing = child(sheet, sheet.documentElement, spreadsheetNs, 'drawing');
        drawing.setAttributeNS(relationshipNs, 'r:id', 'studentQrDrawing');
        addXml('xl/worksheets/sheet1.xml', sheet);
        var sheetRels = parser.parseFromString('<Relationships xmlns="' + packageNs + '"/>', 'application/xml');
        child(sheetRels, sheetRels.documentElement, packageNs, 'Relationship', {
            Id: 'studentQrDrawing', Type: drawingType, Target: '../drawings/studentQr.xml'
        });
        addXml('xl/worksheets/_rels/sheet1.xml.rels', sheetRels);

        var anchors = [], relationships = [];
        images.forEach(function (image, index) {
            if (!/^data:image\/png;base64,/.test(image.dataUrl) || image.row < 1 || image.col < 0) {
                throw new Error('Ảnh QR không hợp lệ. Vui lòng thử xuất lại.');
            }
            var binary = window.atob(image.dataUrl.substring(image.dataUrl.indexOf(',') + 1));
            var png = new Uint8Array(binary.length);
            for (var n = 0; n < binary.length; n++) { png[n] = binary.charCodeAt(n); }
            var id = index + 1, file = 'student-qr-' + id + '.png';
            cfb.utils.cfb_add(zip, 'xl/media/' + file, png, {unsafe: true});
            relationships.push('<Relationship Id="qr' + id + '" Type="' + imageType + '" Target="../media/' + file + '"/>');
            // 90 px square, matching the template's 857250 EMU oneCellAnchor.
            anchors.push('<xdr:oneCellAnchor><xdr:from><xdr:col>' + image.col + '</xdr:col><xdr:colOff>0</xdr:colOff>' +
                '<xdr:row>' + image.row + '</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="857250" cy="857250"/>' +
                '<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="' + id + '" name="Student QR ' + id + '"/>' +
                '<xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>' +
                '<xdr:blipFill><a:blip r:embed="qr' + id + '"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>' +
                '<xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>');
        });
        cfb.utils.cfb_add(zip, 'xl/drawings/studentQr.xml', encoder.encode(
            '<?xml version="1.0" encoding="UTF-8"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"' +
            ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="' + relationshipNs + '">' + anchors.join('') + '</xdr:wsDr>'));
        cfb.utils.cfb_add(zip, 'xl/drawings/_rels/studentQr.xml.rels', encoder.encode(
            '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="' + packageNs + '">' + relationships.join('') + '</Relationships>'));
        var types = readXml('[Content_Types].xml'), contentNs = types.documentElement.namespaceURI;
        if (!Array.prototype.some.call(types.getElementsByTagNameNS(contentNs, 'Default'), function (entry) { return entry.getAttribute('Extension') === 'png'; })) {
            child(types, types.documentElement, contentNs, 'Default', {Extension: 'png', ContentType: 'image/png'});
        }
        child(types, types.documentElement, contentNs, 'Override', {PartName: '/xl/drawings/studentQr.xml', ContentType: drawingContentType});
        addXml('[Content_Types].xml', types);
        return cfb.write(zip, {fileType: 'zip', compression: true});
    }

    function download(bytes, filename) {
        var blob = new window.Blob([bytes], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
        var url = window.URL.createObjectURL(blob), anchor = window.document.createElement('a');
        anchor.href = url; anchor.download = filename; anchor.style.display = 'none'; window.document.body.appendChild(anchor);
        try { anchor.click(); } finally {
            window.setTimeout(function () { anchor.remove(); window.URL.revokeObjectURL(url); }, 60000);
        }
    }
    window.StudentQrWorkbook = {withImages: withImages, download: download};
})(window);
