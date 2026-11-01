(function (root, factory) {
    'use strict';
    if (typeof module === 'object' && module.exports) { module.exports = factory(root); }
    else { root.AppColorPalette = factory(root); }
}(typeof window !== 'undefined' ? window : this, function (window) {
    'use strict';
    var active = null, recent = [], serial = 0;
    var colors = [
        '#000000','#434343','#666666','#999999','#b7b7b7','#cccccc','#d9d9d9','#efefef','#f3f3f3','#ffffff',
        '#980000','#ff0000','#ff9900','#ffff00','#00ff00','#00ffff','#4a86e8','#0000ff','#9900ff','#ff00ff',
        '#e6b8af','#f4cccc','#fce5cd','#fff2cc','#d9ead3','#d0e0e3','#c9daf8','#cfe2f3','#d9d2e9','#ead1dc',
        '#dd7e6b','#ea9999','#f9cb9c','#ffe599','#b6d7a8','#a2c4c9','#a4c2f4','#9fc5e8','#b4a7d6','#d5a6bd',
        '#cc4125','#e06666','#f6b26b','#ffd966','#93c47d','#76a5af','#6d9eeb','#6fa8dc','#8e7cc3','#c27ba0',
        '#a61c00','#cc0000','#e69138','#f1c232','#6aa84f','#45818e','#3c78d8','#3d85c6','#674ea7','#a64d79',
        '#85200c','#990000','#b45f06','#bf9000','#38761d','#134f5c','#1155cc','#0b5394','#351c75','#741b47',
        '#5b0f00','#660000','#783f04','#7f6000','#274e13','#0c343d','#1c4587','#073763','#20124d','#4c1130'
    ];
    function normalize(value) {
        var text=String(value||'').trim(),rgb=text.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i),hex=text.replace(/^#/,'');
        if(rgb&&rgb.slice(1).every(function(n){return Number(n)<=255;})){return '#'+rgb.slice(1).map(function(n){return ('0'+Number(n).toString(16)).slice(-2);}).join('');}
        if(/^[0-9a-f]{3}$/i.test(hex)){hex=hex.split('').map(function(c){return c+c;}).join('');}return /^[0-9a-f]{6}$/i.test(hex)?'#'+hex.toLowerCase():null;
    }
    function contrast(color) { var hex = color.slice(1); return parseInt(hex.slice(0,2),16)*299 + parseInt(hex.slice(2,4),16)*587 + parseInt(hex.slice(4,6),16)*114 > 150000 ? '#26344d' : '#ffffff'; }
    function remember(color) { if (color && colors.indexOf(color)<0 && recent.indexOf(color)<0) { recent.unshift(color); recent=recent.slice(0,8); } }
    function open(options) {
        if (active) { active.close(false); }
        var document = window.document, anchor = options.anchor;
        if (!anchor || !document.documentElement.contains(anchor)) { return null; }
        var parent = options.parent || anchor.closest('[modal-focus],.modal,.mce-window') || document.body;
        var value = normalize(options.value), closed = false, gridButtons = [], form = null;
        var previousExpanded = anchor.getAttribute('aria-expanded'), previousControls = anchor.getAttribute('aria-controls');
        function element(tag, className, text) { var node=document.createElement(tag);node.className=className||'';if(text!==undefined){node.textContent=text;}return node; }
        var panel=element('div','study-notebook-palette app-color-palette');
        panel.id='app-color-palette-'+(++serial);panel.setAttribute('role','dialog');panel.setAttribute('aria-label',options.label||'Bảng màu');
        panel.style.position=parent===document.body?'fixed':'absolute';panel.style.zIndex='200000';panel.style.visibility='hidden';
        anchor.setAttribute('aria-expanded','true');anchor.setAttribute('aria-controls',panel.id);
        function close(restore) {
            if(closed){return;}closed=true;
            document.removeEventListener('mousedown',outside,true);document.removeEventListener('touchstart',outside,true);document.removeEventListener('keydown',keys,true);
            window.removeEventListener('resize',position);document.removeEventListener('scroll',position,true);
            if(panel.parentNode){panel.parentNode.removeChild(panel);}if(active===handle){active=null;}
            if(previousExpanded==null){anchor.removeAttribute('aria-expanded');}else{anchor.setAttribute('aria-expanded',previousExpanded);}
            if(previousControls==null){anchor.removeAttribute('aria-controls');}else{anchor.setAttribute('aria-controls',previousControls);}
            if(restore!==false&&document.documentElement.contains(anchor)){anchor.focus();}
            if(options.onClose){options.onClose();}
        }
        function choose(color) { remember(color);close(false);if(options.onChange){options.onChange(color);} }
        function swatch(color,custom) {
            var button=element('button','study-notebook-swatch');button.type='button';button.style.backgroundColor=color;button.style.color=contrast(color);
            button.title=color.toUpperCase();button.setAttribute('aria-label',(custom?'Màu tùy chỉnh ':'Màu ')+color.toUpperCase());button.setAttribute('aria-pressed',String(value===color));
            if(value===color){button.innerHTML='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7"/></svg>';}
            button.addEventListener('click',function(){choose(color);});return button;
        }
        var grid=element('div','study-notebook-palette-grid');grid.setAttribute('role','group');grid.setAttribute('aria-label','Màu có sẵn');panel.appendChild(grid);
        colors.forEach(function(color,index){var button=swatch(color,false);button.tabIndex=value===color||!value&&index===0?0:-1;grid.appendChild(button);gridButtons.push(button);});
        panel.appendChild(element('div','study-notebook-palette-label','Tùy chỉnh'));var custom=element('div','study-notebook-custom-colors');panel.appendChild(custom);
        remember(value);recent.forEach(function(color){custom.appendChild(swatch(color,true));});
        var add=element('button','study-notebook-add-color');add.type='button';add.setAttribute('aria-label','Thêm màu tùy chỉnh');add.title='Thêm màu tùy chỉnh';
        add.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.5"/><path d="M10 6v8M6 10h8"/></svg>';custom.appendChild(add);
        add.addEventListener('click',function(){
            if(form){form.querySelector('input[type="text"]').focus();return;}
            form=element('form','study-notebook-custom-form');var label=element('label','','Mã màu HEX'),hex=element('input'),row=element('div'),nativeColor=element('input'),apply=element('button','','Áp dụng');
            hex.type='text';hex.maxLength=7;hex.value=value||'#315bbe';hex.setAttribute('aria-label','Mã màu HEX');hex.spellcheck=false;hex.autocomplete='off';label.appendChild(hex);form.appendChild(label);
            nativeColor.type='color';nativeColor.value=normalize(hex.value);nativeColor.setAttribute('aria-label','Chọn màu tùy chỉnh');apply.type='submit';row.appendChild(nativeColor);row.appendChild(apply);form.appendChild(row);panel.appendChild(form);
            hex.addEventListener('input',function(){var color=normalize(hex.value);apply.disabled=!color;if(color){nativeColor.value=color;}});
            nativeColor.addEventListener('input',function(){hex.value=nativeColor.value;apply.disabled=false;});
            form.addEventListener('submit',function(event){event.preventDefault();var color=normalize(hex.value);if(color){choose(color);}});position();hex.focus();
        });
        if(options.allowClear){var clear=element('button','app-color-clear','Không tô màu');clear.type='button';clear.addEventListener('click',function(){choose(null);});panel.appendChild(clear);}
        function position() {
            if(closed){return;}if(!document.documentElement.contains(anchor)){close(false);return;}
            var bounds=anchor.getBoundingClientRect(),origin=parent===document.body?{left:0,top:0}:parent.getBoundingClientRect();
            var viewportWidth=window.innerWidth,viewportHeight=window.innerHeight,width=Math.min(252,viewportWidth-16);panel.style.width=width+'px';
            var height=panel.getBoundingClientRect().height,left=Math.max(8,Math.min(bounds.left-12,viewportWidth-width-8)),top=bounds.bottom+7;
            if(top+height>viewportHeight-8){top=Math.max(8,bounds.top-height-7);}panel.style.left=(left-origin.left)+'px';panel.style.top=(top-origin.top)+'px';
        }
        function outside(event){if(!panel.contains(event.target)&&!anchor.contains(event.target)){close(false);}}
        function keys(event){
            if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();return;}
            if(!panel.contains(event.target)){return;}var index=gridButtons.indexOf(event.target),next=index;
            if(index>=0){
                if(event.key==='ArrowLeft'){next--;}else if(event.key==='ArrowRight'){next++;}else if(event.key==='ArrowUp'){next-=10;}else if(event.key==='ArrowDown'){next+=10;}
                else if(event.key==='Home'){next=event.ctrlKey?0:Math.floor(index/10)*10;}else if(event.key==='End'){next=event.ctrlKey?colors.length-1:Math.floor(index/10)*10+9;}else{next=null;}
                if(next!==null){event.preventDefault();event.stopImmediatePropagation();next=Math.max(0,Math.min(colors.length-1,next));gridButtons.forEach(function(button,i){button.tabIndex=i===next?0:-1;});gridButtons[next].focus();return;}
            }
            if(event.key==='Tab'){
                var controls=Array.prototype.slice.call(panel.querySelectorAll('button:not([disabled]):not([tabindex="-1"]),input:not([disabled])'));
                if(event.shiftKey&&event.target===controls[0]){event.preventDefault();controls[controls.length-1].focus();}else if(!event.shiftKey&&event.target===controls[controls.length-1]){event.preventDefault();controls[0].focus();}
            }
        }
        var handle={element:panel,close:close,reposition:position};active=handle;parent.appendChild(panel);position();panel.style.visibility='visible';
        document.addEventListener('mousedown',outside,true);document.addEventListener('touchstart',outside,true);document.addEventListener('keydown',keys,true);window.addEventListener('resize',position);document.addEventListener('scroll',position,true);
        var selected=panel.querySelector('[aria-pressed="true"]')||gridButtons[0];if(selected){selected.focus();}return handle;
    }
    function attachTinyMce(editor, lifecycle) {
        var picker=null,listeners=[];lifecycle=lifecycle||{};
        function launch(anchor,value,onChange,allowClear){if(picker){picker.close(false);}if(lifecycle.open){lifecycle.open();}
            picker=open({anchor:anchor,value:value,allowClear:allowClear,label:'Bảng màu',onChange:onChange,onClose:function(){picker=null;if(lifecycle.close){lifecycle.close();}}});
            if(!picker&&lifecycle.close){lifecycle.close();}
        }
        editor.settings.color_picker_callback=function(callback,value){launch(window.document.activeElement||editor.getContainer(),value,callback,false);};
        editor.on('init',function(){
            ['forecolor','backcolor'].forEach(function(format){
                var icon=editor.getContainer().querySelector('.mce-i-'+format),anchor=icon,bookmark=null;
                while(anchor&&!anchor.classList.contains('mce-btn')){anchor=anchor.parentElement;}if(!anchor){return;}
                anchor.setAttribute('aria-label',format==='forecolor'?'Màu chữ':'Màu nền');anchor.title=format==='forecolor'?'Màu chữ':'Màu nền';
                function retain(event){bookmark=editor.selection.getBookmark(2,true);event.preventDefault();event.stopImmediatePropagation();}
                function show(event){
                    if(event.type==='keydown'&&['Enter',' ','ArrowDown'].indexOf(event.key)<0){return;}event.preventDefault();event.stopImmediatePropagation();
                    var saved=bookmark||editor.selection.getBookmark(2,true),node=editor.selection.getNode(),value=editor.dom.getStyle(node,format==='forecolor'?'color':'backgroundColor',true);bookmark=null;
                    launch(anchor,value,function(color){if(editor.removed||!editor.getBody()){return;}editor.focus();editor.selection.moveToBookmark(saved);
                        var formatter=format==='backcolor'?'hilitecolor':format;editor.undoManager.transact(function(){if(color){editor.formatter.apply(formatter,{value:color});}else{editor.formatter.remove(formatter,{value:null},null,true);}editor.nodeChanged();});var preview=anchor.querySelector('[id$="-preview"]');if(preview){preview.style.backgroundColor=color||'';}editor.fire('change');},true);
                }
                anchor.addEventListener('mousedown',retain,true);anchor.addEventListener('click',show,true);anchor.addEventListener('keydown',show,true);
                listeners.push(function(){anchor.removeEventListener('mousedown',retain,true);anchor.removeEventListener('click',show,true);anchor.removeEventListener('keydown',show,true);});
            });
        });
        editor.on('remove',function(){if(picker){picker.close(false);}listeners.forEach(function(remove){remove();});});
    }
    function bindQuill(quill) {
        var toolbar=quill.getModule('toolbar'),listeners=[],picker=null,lastRange=null;
        function selection(range){if(range){lastRange={index:range.index,length:range.length};}}
        quill.on('selection-change',selection);
        ['color','background'].forEach(function(format){
            var container=toolbar.container.querySelector('.ql-picker.ql-'+format),label=container&&container.querySelector('.ql-picker-label');if(!label){return;}
            container.classList.add('app-color-picker');label.setAttribute('aria-label',format==='color'?'Màu chữ':'Màu nền');label.setAttribute('aria-haspopup','dialog');
            function launch(event){if(event.type==='keydown'&&event.key!=='Enter'&&event.key!==' '){return;}event.preventDefault();event.stopImmediatePropagation();
                var range=quill.getSelection()||lastRange;if(!range){return;}range={index:range.index,length:range.length};var value=quill.getFormat(range)[format];
                picker=open({anchor:label,value:value,allowClear:true,label:'Bảng màu',onClose:function(){picker=null;},onChange:function(color){quill.setSelection(range.index,range.length,'silent');quill.format(format,color||false,'user');quill.focus({preventScroll:true});}});
            }
            function retain(event){selection(quill.getSelection());event.preventDefault();}
            label.addEventListener('mousedown',retain,true);label.addEventListener('click',launch,true);label.addEventListener('keydown',launch,true);
            listeners.push(function(){label.removeEventListener('mousedown',retain,true);label.removeEventListener('click',launch,true);label.removeEventListener('keydown',launch,true);});
        });
        return function(){if(picker){picker.close(false);}quill.off('selection-change',selection);listeners.forEach(function(remove){remove();});};
    }
    return {colors:colors,normalize:normalize,contrast:contrast,open:open,attachTinyMce:attachTinyMce,bindQuill:bindQuill};
}));
