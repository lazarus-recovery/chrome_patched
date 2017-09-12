
(function(){

	Lazarus.environment = "content";

	Lazarus.Content = {
  
    //time (in milliseconds) the user has to stop typing for 
    //before we send an autosave request to the background page
    autosaveDelay: 2500, 
  
    BUTTON_WIDTH: 16,  //pixels

    BUTTON_HEIGHT: 16, //pixels
    
    MIN_TEXT_FOR_TOOLTIP: 20, //characters
    
    MAX_TEXT_FOR_TOOLTIP: 1024, //characters
    
		init: function(){
		
		},
		
		initDoc: function(doc){
      //TODO: initalise locale? still needed?
      
      Lazarus.callBackground("Lazarus.Background.isDomainEnabled", [doc.domain, function(enabled){
        if (enabled){
          Lazarus.Content.enableDoc(doc);
        }
      }]);
		},
    
    enableDoc: function(doc){
      //add event handlers for this document
      Lazarus.logger.log("init doc", doc.URL);
      Lazarus.Utils.addEvent(doc, "submit", Lazarus.Content.onSubmit);
      Lazarus.Utils.addEvent(doc, "focus", Lazarus.Content.onFocus, true);
      Lazarus.Utils.addEvent(doc, "blur", Lazarus.Content.onBlur, true);
      Lazarus.Utils.addEvent(doc, "keyup", Lazarus.Content.onKeyUp);
      //autosaves
      Lazarus.Utils.addEvent(doc, "change", Lazarus.Content.onChange, true);
      Lazarus.Utils.addEvent(doc, "reset", Lazarus.Content.onReset, true);
      Lazarus.Utils.addEvent(doc, "click", Lazarus.Content.onClick, true);
      //mouse handlers (for popup menu)
      Lazarus.Mouse.initDoc(doc);
      //listen for XHR requests
      //Lazarus.Utils.addEvent(doc, "LazarusXMLHttpRequestSend", Lazarus.Content.onXHR);
      //Lazarus.Utils.insertScript(Lazarus.baseURI +"js/lazarus-xhr-listener.js?r="+ Lazarus.Utils.microtime(), doc, "lazarus-xhr-listener");
    },
    
    
    onClick: function(evt){
      Lazarus.callBackground("Lazarus.Sync.onClick");
    },
    
    onXHR: function(evt){
      try {
        var data = JSON.parse(evt.newValue);
      }
      catch(e){
        //failed to parse json data, is someone firing a non-valid LazarusXMLHttpRequestSend event?
        Lazarus.logger.warn('Invalid LazarusXMLHttpRequestSend data "'+ evt.newValue +'"');
        return;
      }
      
      if (data && data.postData){
        //extract the post data into separate values
        //TODO: handle other encodings (like application/json)
        //at the moment we only handle application/x-www-form-urlencoded
        var formData = Lazarus.Utils.decodeQuery(data.postData);
        var doc = evt.target;
        var texts = Lazarus.Content.getLargeTextFields(doc);
        
        for(var i=0; i<texts.length; i++){
          var textbox = texts[i];
          var textValue = Lazarus.Content.getFieldValue(textbox);
          
          for(var id in formData){
            if (formData[id] == textValue){
              //assume the text has been submitted and make a full save.
              var form = Lazarus.Content.findForm(textbox);
              if (form){
                var info = Lazarus.Content.getFormInfo(form);
                Lazarus.logger.log("saving form...");
                Lazarus.callBackground("Lazarus.Background.saveForm", [info]);
              }
            }
          }
        }
      }
    },
    
    //returns an array of all of the multiline editable fields on a page
    //this should include all WYSIWYGs, ContentEditable divs, and textareas
    //HMMM, possibly quite CPU intensive if there are a large amount of elements on a page (eg google spreadsheet!)
    //needs testing
    getLargeTextFields: function(doc){
      var found = [];
      //get the easy ones
      var eles = doc.getElementsByTagName('textarea');
      for(var i=0; i<eles.length; i++){
        found.push(eles[i]);
      }
      //ContentEditable elements
      //NOTE: at this point we're only going o be looking for divs, not every element on a page (too CPU intensive [untested])
      var eles = doc.getElementsByTagName('div');
      for(var i=0; i<eles.length; i++){
        if (Lazarus.Utils.isLargeTextField(eles[i])){
          found.push(eles[i]);
        }
      }
      
      return found;
    },
    
    
    disableDoc: function(doc, field){
      //disable lazarus on this document
      //remove all of our event handlers
      Lazarus.Utils.removeEvent(doc, "submit", Lazarus.Content.onSubmit);
			Lazarus.Utils.removeEvent(doc, "focus", Lazarus.Content.onFocus, true);
			Lazarus.Utils.removeEvent(doc, "blur", Lazarus.Content.onBlur, true);
			Lazarus.Utils.removeEvent(doc, "keyup", Lazarus.Content.onKeyUp);
			Lazarus.Utils.removeEvent(doc, "change", Lazarus.Content.onChange, true);
			Lazarus.Utils.removeEvent(doc, "reset", Lazarus.Content.onReset, true);
			Lazarus.Utils.removeEvent(doc, "click", Lazarus.Content.onClick, true);
      Lazarus.Utils.removeEvent(doc, "LazarusXMLHttpRequestSend", Lazarus.Content.onXHR);
      Lazarus.Mouse.cleanupDoc(doc);
      if (field){
        //and tidy up the current element
        Lazarus.Content.cleanupField(field);
        
        //XXX TODO: and any form we may have highlighted?
      }
      var script = doc.getElementById("lazarus-xhr-listener");
      if (script){
        script.parentNode.removeChild(script);
      }
    },
    
    onReset: function(evt){
      //if a form field changes value then send an "autosave" message to the background page
      var field = Lazarus.Content.findField(evt.target);
      if (field){
        Lazarus.Content.autosave(field);
			}
      var form = Lazarus.Content.findForm(evt.target);
      if (form && form.formInstanceId){
        form.formInstanceId = null;
      }
    },
    
    onChange: function(evt){
      //if a form field changes value then send an "autosave" message to the background page
      var field = Lazarus.Content.findField(evt.target);
      if (field){
        Lazarus.Content.autosave(field);
			}
    },
    
    
    autosave: function(field, callback){
      callback = callback || function(){}
      //find the form (if any) that this field is attached to
      var form = Lazarus.Content.findForm(field);
      if (form){
        var formInfo = Lazarus.Content.getFormInfo(form);
        
        //if we're currently showing the lazarus icon for this field, then
        //show the user we're saving the form
        if (Lazarus.Utils.getStyle(field, "backgroundImage").indexOf(Lazarus.Content.images.button) > -1){
          Lazarus.Utils.setStyle(field, "backgroundImage", "url('"+ Lazarus.Content.images.buttonSave +"')");
        }
        
        //we'll want the callback so we can tell users when the form has been saved
        Lazarus.callBackground("Lazarus.Background.autosaveForm", [formInfo, function(){
          //restore the autosaved form
          if (Lazarus.Utils.getStyle(field, "backgroundImage").indexOf(Lazarus.Content.images.buttonSave) > -1){
            Lazarus.Utils.setStyle(field, "backgroundImage", "url('"+ Lazarus.Content.images.button +"')");
          }
          callback(formInfo);
        }]);
      }
    },
    
    
		
		onSubmit: function(evt){
		
			var form = (evt.target.nodeName.toLowerCase() == 'form') ? evt.target : null;
			if (form){
				//send details of form to the background page to be saved
				var info = Lazarus.Content.getFormInfo(form);
				Lazarus.logger.log("saving form...");
				Lazarus.callBackground("Lazarus.Background.saveForm", [info]);
        //hmmm, page may be gone by the time this comes back?
        //so we won't add a callback?
			}
		},
		
		generateInstanceId: function(){
			return Math.floor(Math.random() * 2147483648);
		},
		
		
		getFormInfo: function(form){
		
      if (!form.lazarusInstanceId){
        form.lazarusInstanceId = Lazarus.Content.generateInstanceId();
      }
      
			var info = {};
			info.formInstanceId = form.lazarusInstanceId;
			info.url = form.ownerDocument.URL;
			info.domain = form.ownerDocument.domain;
			info.fields = [];
			
			for(var i=0; i<form.elements.length; i++){
				var fieldInfo = Lazarus.Content.getFieldInfo(form.elements[i]);
				if (fieldInfo){
					info.fields.push(fieldInfo);
				}
			}
			
			return info;
		},
		
		
		getFieldInfo: function(field){
			var info = {
        name: field.getAttribute("name"),
        type: Lazarus.Content.getFieldType(field),
				value: Lazarus.Content.getFieldValue(field),
				domain: field.ownerDocument.domain
      };
      //ContentEditables and WYSIWYG dont necessarily have name attributes :(
      if (!info.name && (info.type == "contenteditable" || info.type == "textarea")){
        info.name = "textbox";
      }
      return info;
		},
		
		
		getFieldType: function(field){
			var nodeName = field.nodeName.toLowerCase();
			switch(nodeName){
				case "select":
				case "textarea":
					return nodeName;
				break;
				
				case "input":
					var type = field.type.toLowerCase();
					switch(type){
						case "text":
						case "password":
						case "checkbox":
						case "radio":
							return type;
						break;
					}
				break;
        /*
        case "iframe":
          //only return a field type if the iframe is in edit mode
          if (field.contentDocument && Lazarus.Utils.isEditableDoc(field.contentDocument)){
            return "iframe";
          };
        break;
				*/
			}
      
      //look for WYSIWYG editors
      if (Lazarus.Content.isContentEditableRoot(field)){
        return 'contenteditable';
      }
      //TODO: look for WYSIWYG iframes?
      else {
        return null;
      }
		},
    
    
    //return TRUE if given element is the topmost editable element.
    isContentEditableRoot: function(ele){
      return (ele && ele.isContentEditable && (!ele.parentNode || !ele.parentNode.isContentEditable));
    },
		
		
		getFieldValue: function(field){
			switch(Lazarus.Content.getFieldType(field)){
				//text fields
				case "text":
				case "password":
				case "textarea":
				case "file":
				case "hidden":
					return Lazarus.Utils.trim(field.value);
						
				case "radio":
				case "checkbox":
					return {
						"valueAttr": (field.value === "") ? "on" : field.value,
						"checked": field.checked
					}
						
				case "select":
					//select boxes have the option to allow multiple selections
					var selected = [];
					if (field.options){
						for (var i=0; i<field.options.length; i++){
							if (field.options[i].selected){
								selected.push(Lazarus.Utils.trim(field.options[i].value));
							}
						}
					}
					return selected;
        
        case "contenteditable":
          return field.innerHTML;
				
				case "iframe":
					var doc = field.contentWindow.document;
					return (doc && doc.body && doc.body.innerHTML) ? doc.body.innerHTML : '';
						
				default:
					//unknown element type
					return null;
			}
		},
		
		setFieldValue: function(field, value){

			if (!Lazarus.Utils.isSet(field.lazarusOrigValue)){
				field.lazarusOrigValue = Lazarus.Content.getFieldValue(field);
			}
		
			switch(Lazarus.Content.getFieldType(field)){
				//text fields
				case "text":
				case "password":
				case "textarea":
				case "file":
					field.value = value;
				break;
				
				case "radio":
				case "checkbox":
					field.checked = value;  
				break;
				
				case "select":
					//select boxes have the option to allow multiple selections
					if (field.options){
						for (var i=0; i<field.options.length; i++){
							//bugfix: RT: 101284
							//selecting each option is taking too long for large (10,000+) select boxes,
							//so we should only change the option if it doesn't already match it's new selected state
							var selectOption = Lazarus.Utils.inArray(field.options[i].value, value);
							if (field.options[i].selected != selectOption){
								field.options[i].selected = selectOption;
							}
						}
					}
					break;
        
        case "contenteditable":
          field.innerHTML = value;
        break;
						
				default:
					//unknown element type
          Lazarus.logger.error("setFieldValue: Unknown field type '"+ Lazarus.Content.getFieldType(field) +"'");
			}
		},
    
    //this has been written as a callback so that we can add checks from the background page later on
    canSaveField: function(field, callback){
      if (!field){
        callback(false);
      }
      else {
        callback(Lazarus.Content.findForm(field));
      }
    },
		
		onFocus: function(evt){
    
			var field = Lazarus.Content.findField(evt.target);
      
      if (field){
        Lazarus.Content.canSaveField(field, function(canSave){
          if (canSave){
            //show the lazarus button
            switch(Lazarus.Content.getFieldType(field)){
              case "password":
                Lazarus.getPref("savePasswords", function(savePasswords){
                  if (savePasswords){
                    Lazarus.Content.showButton(field);
                  }
                });
              break;
              
              case "contenteditable":
              case "textarea":
              case "text":
                Lazarus.Content.showButton(field);
              break;
            }
          }
        });
      }
		},
		
		
		fetchSavedFields: function(field, callback){
			var info = Lazarus.Content.getFieldInfo(field);
			
			Lazarus.callBackground("Lazarus.Background.fetchSavedFields", [info, function(fields){
				if (callback){
					callback(fields);
				}
			}]);
		},
		
		onBlur: function(evt){
			var field = Lazarus.Content.findField(evt.target);
			if (field){
				Lazarus.Content.cleanupField(field);
			}
		},
    
    
    cleanupField: function(field){
      //hide the lazarus button
      Lazarus.Content.hideButton(field);
      Lazarus.Utils.removeEvent(field, "mousemove", Lazarus.Content.onFocusedFieldMouseMove);
      Lazarus.Utils.removeEvent(field, "mousedown", Lazarus.Content.onFocusedFieldMouseDown);
      //and close the lazarus menu if it's open,
      //unless the menu now has the focus!
      if (field.ownerDocument.lazarusMenu){
        //hmmm, hiding the menu immedately is causing some click events not to fire,
        setTimeout(field.ownerDocument.lazarusMenu.hide, 1);
      }
    },
    
    
		
		showButton: function(ele){
      var CHECK_SIZE_CHANGE_INTERVAL = 100; //milliseconds
      
			Lazarus.logger.log("showBtn");
      //we're going to use a background image as our button because absolutely positioning a real button
      //is next to impossible to do correctly on every page
      
      //save original background image (if any)
      Lazarus.Utils.setStyle(ele, "backgroundRepeat", "no-repeat");
      Lazarus.Utils.setStyle(ele, "backgroundImage", "url('"+ Lazarus.Content.images.button +"')");
      //background cannot be positioned to the right, because it'll be hidden by any scrollbars that appear
      ele.lazarusButtonX = (ele.clientWidth - Lazarus.Content.BUTTON_WIDTH);
      Lazarus.Utils.setStyle(ele, "backgroundPosition", ele.lazarusButtonX +"px 0px");
      
      //update the background position if the content changes size (eg scrollbars are added because the content got too large)
      //oninput works well for the scrollbar detection, and we can use onmousemove for if the user tries to resize a textbox
      //but I get the feeling it's probably simplier to just poll the size of the element and see if it changes
      ele.lazarusSizeChangeTimer = setInterval(function(){
        if (ele.lazarusButtonX != (ele.clientWidth - Lazarus.Content.BUTTON_WIDTH)){
          ele.lazarusButtonX = (ele.clientWidth - Lazarus.Content.BUTTON_WIDTH);
          Lazarus.Utils.setStyle(ele, "backgroundPosition", ele.lazarusButtonX +"px 0px");
        }
      }, CHECK_SIZE_CHANGE_INTERVAL);
      
      //watch for the mouse to move over the button
      Lazarus.Utils.addEvent(ele, "mousemove", Lazarus.Content.onFocusedFieldMouseMove);
      Lazarus.Utils.addEvent(ele, "mousedown", Lazarus.Content.onFocusedFieldMouseDown, true);
		},
    
    
    highlightButton: function(ele){
      Lazarus.Utils.setStyle(ele, "backgroundImage", "url('"+ Lazarus.Content.images.buttonHighlighted +"')");
      Lazarus.Utils.setStyle(ele, "backgroundRepeat", "no-repeat");
      Lazarus.Utils.setStyle(ele, "backgroundPosition", ele.lazarusButtonX +"px 0px");
    },
    
    unhighlightButton: function(ele){
      Lazarus.Utils.setStyle(ele, "backgroundImage", "url('"+ Lazarus.Content.images.button +"')");
      Lazarus.Utils.setStyle(ele, "backgroundRepeat", "no-repeat");
      Lazarus.Utils.setStyle(ele, "backgroundPosition", ele.lazarusButtonX +"px 0px");
    },
    
    onFocusedFieldMouseDown: function(evt){
    
      var ele = evt.target;
      var field = Lazarus.Content.findField(evt.target);
      
      if (Lazarus.Content.isMouseOverButton(evt, field)){
        //show the list of recoverable forms for this field.
        if (Lazarus.Content.getFieldType(field) == "password"){
          Lazarus.getPref("savePasswords", function(savePasswords){
            if (savePasswords){
              Lazarus.Content.showMenu(field, evt);
            }
          })
        }
        else {
          Lazarus.Content.showMenu(field, evt);
        }
        //prevent the click from bubbling
        evt.preventDefault();
        evt.stopPropagation();
        return false;
      }
    },
    
    
    onFocusedFieldMouseMove: function(evt){
      
      var ele = evt.target;
      var field = Lazarus.Content.findField(evt.target);
      
      if (field === ele){
        if (Lazarus.Content.isMouseOverButton(evt, field)){
          Lazarus.Utils.setStyle(field, "cursor", "pointer");
          Lazarus.Utils.setAttr(field, "title", Lazarus.locale.getString("btn.show.menu.tooltip"));
          Lazarus.Content.highlightButton(field);
        }
        else {
          Lazarus.Content.unhighlightButton(field);
          Lazarus.Utils.restoreStyle(field, "cursor");
          Lazarus.Utils.restoreAttr(field, "title");
        }
      }
    },
    
    
    showMenu: function(field, evt){
      
      var doc = field.ownerDocument;
      
      //save the current state of the form so we can restore it if the user doesn't restore a saved form
      var form = Lazarus.Content.findForm(field);
			if (form){
				form.lazarusOrigFormInfo = Lazarus.Content.getFormInfo(form);
				
				var menu = Lazarus.Content.buildMenu(field);
				
				//check if the "restore" functionality requires the user to login
				Lazarus.callBackground("Lazarus.Background.isPasswordRequired", [function(isPasswordRequired){
					if (isPasswordRequired){
						//add an enter password menu item
						menu.addItem(Lazarus.locale.getString("menu.enter.password"), {
							icon:Lazarus.Content.images.lock,
							onclick: function(){
								Lazarus.dialog(Lazarus.baseURI +"login.html", {
									modal: true,
									width: 510,
									height: 210,
									doc: doc,
									callback: function(loggedIn){
										if (loggedIn){
											//show the restore fields menu
											Lazarus.Content.buildRestoreMenuItems(field);
										}
										else {
											//just hide the menu
											menu.hide();
											//and re-focus back on the original field
											field.focus();
										}
									}
								})
							}, 
							tooltip: Lazarus.locale.getString("menu.enter.password.tooltip")
						});
						
						//add an options menuitem
						Lazarus.Content.addAdditionalMenuitems(doc.lazarusMenu, field);
					}
					else {
						//just show the restore menu items 
						Lazarus.Content.buildRestoreMenuItems(field);
					}
				}]);
      }
    },
    
    
    buildMenu: function(ele){
      
      var doc = ele.ownerDocument;
      
      //remove any old menu
      if (doc.lazarusMenu){
        doc.lazarusMenu.remove();
      }
      
      //build the new menu
      doc.lazarusMenu = new Lazarus.Menu();
      doc.lazarusMenu.init(doc);
      
      Lazarus.Content.positionMenu(doc.lazarusMenu, ele);
      
      doc.lazarusMenu.show();
      
      return doc.lazarusMenu;
    },
    
    positionMenu: function(menu, ele){
      //and show it next to the element
      //XXX FIXME: make this work on framed pages (especially disqus forms which appear inside iframes!)
      
      var doc = ele.ownerDocument;
      var box = Lazarus.Utils.getBox(ele);
      var docBox = Lazarus.Utils.getBox(doc.documentElement);
      
      //default is to attach the menu to the top right corner of the element,
      var x = box.right;
      var y = box.top;
      
      if (box.right + menu.width >= docBox.right){
        //if that won't work then we're going to move it to the left so that it actually overlaps the element
        x = box.right - (menu.width + Lazarus.Content.BUTTON_WIDTH);
      }
      
      menu.position(x, y);
    },
    
    
    buildRestoreMenuItems: function(field){
    
      var form = Lazarus.Content.findForm(field);
      var fieldType = Lazarus.Content.getFieldType(field);
      var doc = field.ownerDocument;
      var menu = Lazarus.Content.buildMenu(field);
      
      //add the loading menuitem
      if (Lazarus.Utils.isLargeTextField(field)){
        //save the current text of this field
        field.lazarusOrigValue = Lazarus.Content.getFieldValue(field);
        menu.addItem(Lazarus.locale.getString("menu.loading.saved.text"), {icon:Lazarus.Content.images.loading});
      }
      else {
        //save the form values
        menu.addItem(Lazarus.locale.getString("menu.loading.saved.forms"), {icon:Lazarus.Content.images.loading});
      }
      
      //add an options menuitem
      Lazarus.Content.addAdditionalMenuitems(menu, field);
      
      //now fetch the saved forms for this element
      if (Lazarus.Utils.isLargeTextField(field)){
        var domain = field.ownerDocument.domain;
        //XXX FIXME: just get summaries of text?
        Lazarus.callBackground("Lazarus.Background.fetchSavedText", [domain, function(rs){
          menu.removeAll();
          if (rs.length > 0){
            for(var i=0; i<rs.length; i++){
              Lazarus.Content.addRestoreTextMenuitem(menu, rs[i].text, field);
            }
          }
          else {
            //show no saved forms message
            menu.addItem(Lazarus.locale.getString("menu.no.saved.text"), {
              disabled: true
            });
          }
          //better re-add the options menu item too
          Lazarus.Content.addAdditionalMenuitems(menu, field);
        }]);
      }
      else {
        Lazarus.Content.fetchSavedFields(field, function(rs){
          Lazarus.logger.log("fetchSavedFields", rs);
          //rebuild the menu
          menu.removeAll();
          if (rs.length){
            if (form){
              for(var i=0; i<rs.length; i++){
                Lazarus.Content.addRestoreFormMenuitem(menu, rs[i], form, field);
              }
            }
            else {
              throw Error("Unable to find form from element");
            }
          }
          else {
            //show no saved forms message
            menu.addItem(Lazarus.locale.getString("menu.no.saved.forms"), {
              disabled: true
            });
          }
          //better re-add the options menu item too
          Lazarus.Content.addAdditionalMenuitems(menu, field);
        });
      }
    },
    
    generateTooltip: function(text){
      //only generate a tooltip if the text is long 
      if (text.length > Lazarus.Content.MIN_TEXT_FOR_TOOLTIP){
        return text.substr(0, Lazarus.Content.MAX_TEXT_FOR_TOOLTIP);
      }
      else {
        return '';
      }
    },
    
    //tidy up text and make it usable for a menu item or tooltip
    tidyText: function(text){
      //replace multiple line breaks with 2 line breaks
      text = text.replace(/\w*\n(\w*\n)+/g, "\n\n");
      
      //strip whitespace from the begining and end of the string
      return Lazarus.Utils.trim(text);
    },
    
    addRestoreFormMenuitem: function(menu, rec, form, field){
      
      var tidyText = Lazarus.Content.tidyText(rec.text);
      
      //passwords should not be shown
      if (tidyText && Lazarus.Content.getFieldType(field) == "password"){
        tidyText = tidyText.substr(0, 1) + tidyText.substr(1, tidyText.length-2).replace(/./g, '*') + tidyText.substr(-1, 1);
      }
      
      //add the menuitem to the menu
      var menuitem = menu.addItem(tidyText, {
        data: rec,
        onclick: function(){
          //restore this form
          var onRestoreForm = function(form, restoredFields){
            //better restore ALL the fields original styles
            for(var i=0; i<form.elements.length; i++){
              Lazarus.Content.unhighlightField(form.elements[i]);
            }
            menu.hide();
            field.focus();
            //and move the carot to the end of the new text
            field.selectionStart = field.value.length;  
          }
          
          if (rec.formInfo){
            form.lazarusOrigFormInfo = null;
            Lazarus.Content.restoreForm(form, rec.formInfo, onRestoreForm);
          }
          else {
            //TODO: show loading icon for this menuitem
            Lazarus.callBackground("Lazarus.Background.fetchForm", [rec.formId, function(formInfo){
              if (formInfo){
                //prevent the onmouseout handler (which will fire when the menu dissapears) from restoring the original text
                form.lazarusOrigFormInfo = null;
                Lazarus.Content.restoreForm(form, formInfo, onRestoreForm);
              }
              else {
                Lazarus.msg("error.cannot.find.form", "error")
              }
            }]);
          }
        }
        //tooltip no longer needed because we're showing the text in the form fields anyway
        //tooltip: Lazarus.Content.generateTooltip(tidyText)
      });
      
      // when the user mouses over the menuitem, we want to show the recoverable form fields inside the current form
      Lazarus.Utils.addEvent(menuitem, 'lazarus:hover', function(evt){
        //console.log("lazarus:hover", evt);
        
        if (rec.formInfo){
          Lazarus.Content.showRestoreableFormInfo(form, rec.formInfo);
        }
        else {
          Lazarus.callBackground("Lazarus.Background.fetchForm", [rec.formId, function(formInfo){
            if (formInfo){
              rec.formInfo = formInfo;
              //are we still trying to show this restorable form, or has the user moved their mouse away?
              if (Lazarus.Mouse.isOverEle(menuitem)){
                Lazarus.Content.showRestoreableFormInfo(form, rec.formInfo);
              }
            }
            else {
              Lazarus.msg("error.cannot.find.form", "error")
            }
          }]);
        }
      });
      
      Lazarus.Utils.addEvent(menuitem, 'mouseout', function(){
        if (Lazarus.Utils.isSet(form.lazarusOrigFormInfo)){
          //restore original form values
          Lazarus.Content.restoreForm(form, form.lazarusOrigFormInfo, function(){
            //better restore ALL the fields original styles
            for(var i=0; i<form.elements.length; i++){
              Lazarus.Content.unhighlightField(form.elements[i]);
            }
          });
        }
      });
    },
    
    showRestoreableFormInfo: function(form, formInfo){
      Lazarus.Content.restoreForm(form, formInfo, function(form, restoredFields){
        for(var i=0; i<restoredFields.length; i++){
          Lazarus.Content.highlightField(restoredFields[i]);
        }
      });
    },
    
    
    addRestoreTextMenuitem: function(menu, text, field){
    
      var tidyText = Lazarus.Content.tidyText(text);
      
      //add the menuitem to the menu
      var menuitem = menu.addItem(tidyText, {
        onclick: function(){
          //console.log("restoring text", text);
          //prevent the onmouseout handler (which will fire when the menu dissapears) from restoring the original text
          field.lazarusOrigValue = null;
          
          //restore the text
          Lazarus.Content.setFieldValue(field, text);
          Lazarus.Content.unhighlightField(field);
          menu.hide();
          field.focus();
          //and move the carot to the end of the new text
          field.selectionStart = field.value.length;
        },
        tooltip: Lazarus.Content.generateTooltip(tidyText)
      });
      
      //when the user mouses over the menuitem, we want to show the current text temporarily inside the textbox
      Lazarus.Utils.addEvent(menuitem, 'mouseover', function(){
        Lazarus.Content.setFieldValue(field, text);
        Lazarus.Content.highlightField(field);
      });
      
      Lazarus.Utils.addEvent(menuitem, 'mouseout', function(){
        if (Lazarus.Utils.isSet(field.lazarusOrigValue)){
          //restore original text
          Lazarus.Content.setFieldValue(field, field.lazarusOrigValue);
          Lazarus.Content.unhighlightField(field);
          field.lazarusCurrTextCreated = null;
        }
      });
    },
    
    
    highlightField: function(field){
      Lazarus.Utils.setStyle(field, 'color', '#999999');
      Lazarus.Utils.setStyle(field, 'backgroundColor', '#FFFFDD');
    },
    
    unhighlightField: function(field){
      Lazarus.Utils.restoreStyle(field, 'color');
      Lazarus.Utils.restoreStyle(field, 'backgroundColor');
    },
    
    
    addAdditionalMenuitems: function(menu, ele){
      menu.addSeparator();
      menu.addItem(Lazarus.locale.getString("menu.options"), {
        onclick: function(){
          Lazarus.callBackground("Lazarus.Background.openOptions");
        }, 
        tooltip: Lazarus.locale.getString("options.tooltip")
      });
      
      var domain = ele.ownerDocument.domain;
      
      menu.addSeparator();
      menu.addItem(Lazarus.locale.getString("disable.domain"), {
        onclick: function(){
          //confirm
          if (confirm(Lazarus.locale.getString("disable.domain.confirm", {domain:domain}))){
            //disable by domain
            Lazarus.callBackground("Lazarus.Background.disableByDomain", [domain, function(success){
              if (success){
                Lazarus.Content.disableDoc(ele.ownerDocument, ele);
                Lazarus.msg("disable.domain.success", "success", {domain:domain});
              }
              else {
                Lazarus.msg("generic.error.msg", "error");
              }
              ele.focus();
            }]);
          }
        }, 
        tooltip: Lazarus.locale.getString("disable.domain.tooltip", {domain:domain})
      });
      
      //if the user is logged in, then add a logout option
      Lazarus.callBackground("Lazarus.Background.isLoggedIn", [function(loggedIn){
        if (loggedIn){
          menu.addSeparator();
          menu.addItem(Lazarus.locale.getString("menu.logout"), {
            onclick: function(){
              Lazarus.callBackground("Lazarus.Background.logout", [function(){
                menu.hide();
								ele.focus();
              }]);
            }, 
            tooltip: Lazarus.locale.getString("menu.logout.tooltip"),
            icon: Lazarus.Content.images.lock
          });
        }
      }]);
    },
    
    
    
    isMouseOverButton: function(evt, ele){
      //find mouse position inside element.
      //console.log('isMouseOverButton', evt.offsetX, ele);
      if (typeof evt.offsetX == "undefined"){
        evt = Lazarus.Utils.fixEvent(evt);
      }
      
      return (evt.offsetX > ele.lazarusButtonX && evt.offsetX <= ele.lazarusButtonX + Lazarus.Content.BUTTON_WIDTH && evt.offsetY <= Lazarus.Content.BUTTON_HEIGHT);
    },
    
    
    hideButton: function(ele){
      if (ele.lazarusSizeChangeTimer){
        clearInterval(ele.lazarusSizeChangeTimer);
      }
      Lazarus.Utils.restoreStyle(ele);
      Lazarus.Utils.removeEvent(ele, "mousemove", Lazarus.Content.onFocusedFieldMouseMove);
      Lazarus.Utils.removeEvent(ele, "mousedown", Lazarus.Content.onFocusedFieldMouseDown, true);
    },
		
		findField: function(ele){
			var type = Lazarus.Content.getFieldType(ele);
      if (type){
        return ele;
      }
      else {
      
        //look for content editable divs.
        var editableEle = Lazarus.Utils.findParent(ele, function(ele){
          //if this node is editable, but the parent is not then we have found the editable root node
          if (ele.isContentEditable && (!ele.parentNode || !ele.parentNode.isContentEditable)){
            return ele;
          }
          else {
            return false;
          }
        });
        
        if (editableEle){
          return editableEle;
        }
				/*
        //content editable iframes (WYSIWYG)
        else if (Lazarus.Content.isContentEditableIframe(ele) && ele.ownerDocument.defaultView.frameElement){
          return ele.ownerDocument.defaultView.frameElement;
        }
				*/
        else {
          return null;
        }
      }
		},
		
		
		onKeyUp: function(evt){
			
			//fetch the textbox from this event
			var field = Lazarus.Content.findField(evt.target);
      if (field){
				var fieldType = Lazarus.Content.getFieldType(field);
        
        if (fieldType == "text" || Lazarus.Utils.isLargeTextField(fieldType)){
          Lazarus.Content.restartAutosaveTimer(field);
        }
				
        //XXX FIXME: show the menu if the user hits the lazarus key combo.
        return;
        
				//if the user hits the "restore last text" key combo 
				//(for now hard coded CTRL + SHIFT + UP_ARROW)
				//restore the last used text for this domain
				// var KEY_ARROW_LEFT = 37;
				// var KEY_ARROW_RIGHT = 39;
				
				// var KEY_LESSTHAN = 188;
				// var KEY_GREATERTHAN = 190;
				
				// if (evt.keyCode == KEY_LESSTHAN && evt.ctrlKey && evt.shiftKey){
          
					// evt.stopPropagation();
					// evt.preventDefault();
					// if (fieldType == "textarea"){
						// Lazarus.Content.restorePreviousText(field);
					// }
					// else {
						// Lazarus.Content.restorePreviousForm(field);
					// }
				// }
				// if (evt.keyCode == KEY_GREATERTHAN && evt.ctrlKey && evt.shiftKey){
					// evt.stopPropagation();
					// evt.preventDefault();
					// if (fieldType == "textarea"){
						// Lazarus.Content.restoreNextText(field);
					// }
					// else {
						// Lazarus.Content.restoreNextForm(field);
					// }
				// }
			}
		},
    
    
    restartAutosaveTimer: function(field){
      clearTimeout(Lazarus.Content.autosaveTimer);
      Lazarus.Content.autosaveTimer = setTimeout(function(){
        //need to check if field still exists?
        if (Lazarus.Content.fieldExists(field)){
          Lazarus.Content.autosave(field);
        }
      }, Lazarus.Content.autosaveDelay);
    },
    
    
    fieldExists: function(field){
      //XXX TODO: detect if the field and it's document still exist?
      return true;
    },
		
		
		restoreForm: function(form, formInfo, callback){
		
			//save the current form state so we can restore it later if we need to.
			if (!form.lazarusOrigFormInfo){
				form.lazarusOrigFormInfo = Lazarus.Content.getFormInfo(form);
			}
      
			//fetch the values for this form.
			Lazarus.logger.log("restoring form...");
			
			//some forms have multiple elements with the same name (think radiogroups or php forms with multiple textboxes called "names[]")
			//for these fields we're going to have to check their value to see if it matches ours
			//we are going to be altering some of the formInfo fields, so we should work on a copy of it, not the original
			formInfo = Lazarus.Utils.clone(formInfo);
			
			Lazarus.getPref("savePasswords", function(savePasswords){
				
        var restoredFields = [];
				for(var i=0; i<form.elements.length; i++){
					var field = form.elements[i];
					var fieldInfo = Lazarus.Content.getFieldInfo(field);
					if (fieldInfo){
						//find the matching fieldInfo
						for(var j=0; j<formInfo.fields.length; j++){
							var savedFieldInfo = formInfo.fields[j];
							if (!savedFieldInfo.restored && savedFieldInfo.name == fieldInfo.name && savedFieldInfo.type == fieldInfo.type){
								//special case, checkboxes
								switch(fieldInfo.type){
									case "text":
									case "textarea":
									case "select":
										Lazarus.Content.setFieldValue(field, savedFieldInfo.value);
										savedFieldInfo.restored = true;
                    restoredFields.push(field);
									break;
									
									case "password":
										if (savePasswords){
											Lazarus.Content.setFieldValue(field, savedFieldInfo.value);
                      restoredFields.push(field);
                      savedFieldInfo.restored = true;
										}
										else {
                      //DONT add this field to the restored fields
											//Lazarus.Content.setFieldValue(field, "");
										}
									break;
									
									case "radio":
									case "checkbox":
										if (fieldInfo.value && (fieldInfo.value.valueAttr == savedFieldInfo.value.valueAttr)){
											Lazarus.Content.setFieldValue(field, savedFieldInfo.value.checked);
											savedFieldInfo.restored = true;
                      restoredFields.push(field);
										}
									break;
								}
                //and stop looking for matching fields
                continue;
							}
						}
					}
				}
				//mark the form as currently showing a saved form.
				form.lazarusCurrFormId = formInfo.id || null;
				Lazarus.logger.log("form restored "+ (formInfo.id || "original"));
        if (callback){
          callback(form, restoredFields);
        }
			});
		},
		
		
		
		/**
		* return a form from an element
		**/
		findForm: function(ele){
      
			var form = Lazarus.Utils.findParent(ele, function(ele){
        if (ele.nodeName.toLowerCase() == "form"){
          return ele;
        }
        else if (ele.form){
          return ele.form;
        }
        else {
          return false;
        }
      });
      
      if (form){
        return form;
      }
      //support non-form textareas and WYSIWYGs 
      else if (Lazarus.Utils.isLargeTextField(ele)){
        //create a fake form?
        return new Lazarus.Content.FakeForm(ele);
      }
			/*
      else if (Lazarus.Content.isContentEditableIframe(ele) && ele.ownerDocument.defaultView.frameElement){
        return new Lazarus.Content.FakeForm(ele.ownerDocument.defaultView.frameElement);
      }
			*/
      else {
        return null;
      }
		},
    
    
    isContentEditableIframe: function(ele){
      return ele.ownerDocument ? Lazarus.Utils.isEditableDoc(ele.ownerDocument) : false;
    },
		
		
		isTextarea: function(ele){
      return (ele && ele.nodeName && ele.nodeName.toLowerCase() == "textarea");
    },
    
    images: {
      button: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAALHRFWHRDcmVhdGlvbiBUaW1lAEZyaSAxMiBOb3YgMjAxMCAxOTowNzowMiArMTIwMOGr8p4AAAAHdElNRQfaCwwGBxwduq16AAAACXBIWXMAAAsSAAALEgHS3X78AAAABGdBTUEAALGPC/xhBQAAAfJJREFUeNqVkk1vElEUhp87X4CIFhhMG0toMC5K3Lgxbro10bhxY2Jc+CO666Y/oP/DxFVjTKM7l1apTdM0JSU0LSg0WqaUjwE6MDNebGpKBYlndc+55zw5H6/gim2UUd0qs5Uy6VaTa7EYdtOmUN7naHER92q+dtnZ2UFpHTOTXWfuwxrfYlNUHz1lxvdIVyx6MuXHPwFeBLW2z+29Pepr7ziUof7SEq1CibCEmKMAymXH6SD6LrpzRndQPIjNz9P3odu2URlhQ4C+ghcM0JpLEchkzrv7eIDS62JYP2lPBJS2cIMhyrMpwo+fMbW8jLhhc2t3F906pjoK8GcH29vonoenRDk1m5zcvUM6ZuJvZEnmcljT09hbR6iVIuLJw/PxhgAOPOj26Gk1nEQCNWAQ7XS4bxvw8hWuGedeo4iR+/y7+OtfgM1N9OIBwnFQ5SLdZJJ2JML17BdqEuYHgmiahsjnx4zw/i2fslm8dht/YQHx/AWpfI50/ZTKm9d8lykiHkf4/hjA6ipnF++VFRS7T1AoaDejyCEYlHmWNeEKF9YISz30CBkGirxKUIZGamAsQG2hux66BAipi1A6g/5fAM/HkGrUFfmr6wSSiWHJTwQoPrq8hCYEGDoh0xzfwUhyIY9ROkRrNKQ65e1P6uM7+AW+ibcHEM1ixAAAAABJRU5ErkJggg==',
      
      buttonSave: 'data:image/png;base64,' +
        'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAALHRFWHRDcmVhdGlvbiBUaW1lAFN1'+
        'biAyOCBOb3YgMjAxMCAxNDozNzoyNyArMTIwMCoiLe0AAAAHdElNRQfaCxwBJgI+fMTgAAAACXBI'+
        'WXMAAAsSAAALEgHS3X78AAAABGdBTUEAALGPC/xhBQAAAmlJREFUeNqFks1PE0EYh38zs1/tlrbU'+
        'goLIlzFKPZoYLsQbiYkX/xW5cZCjf48xRE5oNEYiBgkhCFgCBQqRdu3S7vd2Z53WUIFs9D3tzM48'+
        '++7z/giu1dcqWFTHyEkVk1YL6UIBdstGubqH07k5RNfPS5cXm5ugVg1DqysYX1rEUSGP+uwzDMUc'+
        'kycGQnHk5z8BvA+ssYfbOzs4X3yDA7HVnp+HVT6ELiDFJAC9vAhckHYEOfDhdS539qam0I4Bz7HB'+
        'kFBXAG0Krqmwxseglkp/unu3Dxp6UIwzOP8FHK4j0lKojoxBf/oc+YUFkKyNwa0tyEYN9SQAuXjY'+
        '2IDMOTjtBz3ew93K8YsnWnom3a8bA67T5/RlRw0m0RhxVx0/NWz4frjdkxgAj70QodRAMDAgZDYH'+
        'S8WiyUsTw9D1HJdlDEeRJ1ktym/dfFRZ/nKEyuHRgx5gbQ1yZR8kCMCEyGjiPglUxVMdO+WEAYl5'+
        '5LOIh8S2gXSqCdd14Hv+3zG+fY3Pq6vgjoN4Zgbk3sPUbBiGRVUpmpnMUMN1XQEPkNEjmKYJW5A6'+
        'EJIkZncXdOnjq5eaxgtpZeJMUe/UYlFcSOqKIwS/WhHqtdrVIF1UUwfx/HNF1TL0+MyUQLOEMSnu'+
        'BS7iXYglukgEMKsTJof5PkM25SmjwxmWy+W5xAhEI9j6UcX38ikC372ag94XYijipQB4kFgoLX9a'+
        'Z64Y0eCNDAo5DYzynoPEDsS05Tg2Hc+VNV125P6szjrJbjabEGK7lx1hO4qCZEB5F4qE5W8H+9PT'+
        'lfg8nc9T+v7DCtpivp1fMEwLZsMCZWz7N+VdN+XTt1UiAAAAAElFTkSuQmCC',
      
      buttonHighlighted: 'data:image/png;base64,' +
        'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAALHRFWHRDcmVhdGlvbiBUaW1lAE1vbiAx' +
        'NCBBcHIgMjAwOCAxNTo1OTowMCArMTIwMGlJSD0AAAAHdElNRQfYBA4DOxwNE+g/AAAACXBIWXMAAAsS' +
        'AAALEgHS3X78AAAABGdBTUEAALGPC/xhBQAAAglJREFUeNqVkk1rE1EUhp9MvpvvSVJLTKgaBJsfoG7d' +
        'FBShBFGhXQi6FUG7ELrp3u7cuFWEblx0UQtuVBBBbUJbSmlITIkJJIXWNJhkmjpJZrxBKk2dWDxw4d73' +
        'nPvAOec1cSzSZYa635mqlHnUbHBWlsk3FJ6Ut3g1PU3reL3l6GNjA1tzlxupz9x/s8Rz2c/b8evc1DUe' +
        'VKrURMniPwGaB1dti8lsltWlRZ4JqT4zQzZfIi4gV4wA0tGH2sLc6RJQf1Lpfe5pY2M0dKjsKzgxiD5A' +
        'R0J12MmcGWU4kcDd094XcLQPCFZ3KJ4IKK2hOJzMR0eJX01ycXYWyaswvrmJv7rLOyPAnxmsrxPQNFQp' +
        'QDrU4OP5OA/lEN10iruZDB9GRvi6to2rUsR87fLv9voAKrw+aLNnqVENh3HabVxqtXip2NCm7tAMBXla' +
        'LyJnvqCI8lt/AVZW8BYLmFWVITHI/ViMgsfDhdQyywKm2x24LRasuRy6USskkwxHo8jCON6JCfyfVnn8' +
        'Yp7t25PcE2mrOM5gEE8vbziDhQV2Du9zc9iVDhGThM8XICSkrjjtavWELRxG3SX80CZms2EXW4kIyc2A' +
        'MASYmwS6GrIASMIXsXMJ/P8F0HSCwo0+SWStViKxcH/fJwIkHVlswmsygc3K6VBoMMBiJOZzyKVveOvC' +
        'LqUip/Z+DG7hF3v2sMOtgGnDAAAAAElFTkSuQmCC',
      
      loading: 'data:image/gif;base64,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',
    
      //http://jonasraskdesign.com
      lock: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAALHRFWHRDcmVhdGlvbiBUaW1lAFN1biAyMSBOb3YgMjAxMCAwOTozNzoyNSArMTIwMO4evnUAAAAHdElNRQfaCxQUJiOtTJ3KAAAACXBIWXMAAAsSAAALEgHS3X78AAAABGdBTUEAALGPC/xhBQAAAoJJREFUeNqFU89PE0EYfbO7dH+0tFLAiEYOxAOoiUgvHjj4F3jRxDuJeuBCOHlRD6BH0gtejCHh1hAvphIOxERDvCnIhcaQWIFCW8lqt91t9+f47QZrEYxfMjuZnfe99837ZoDTQ1paWnq+tbXFwzisVPjrfH4lk8n04X8xOzs7WqaEML4Wi3xleZl/3tiI1rquc9of68SzzsX4+HjP/Py8PjI8jIWFBRyUy0ilUus/a7XrmqpiamoKhUIBk5OT6bW1tR8n1BcXF58WSfXt6iqfm5s76NzLZrMz+Xye7+3s8FwuN/P7v9AJSvf23pYEAXqthunp6YHOPVJ/REdwHc+Dpml3TiUQRKVHVLoRjyeN0/zp7ulvSXICTFLTbbePGVL50GWXbMSsfUHPXh48vPbgfJeUhKtXEP/0cL/g7TJeDsC+b7bz2iauzwy+HL37bMKsbkPWEpCGMoB6liRkwKkDjQO4xY+wrRbifUPYePXkxdjjvfttppiiTiB5DkL1DWA34e+WwGJEIMjgQR3MKoHb3yAiCdZ3E4qi3qO0PwRGy6ZvA6Jag2404TYrYGKNahSBwEHgm5C5hdSZEF0/wnd4YDYdjoAzxzKgyAFUySJ1N/KZcQ9B4AGuC7tlIuYTRdPlxwnqLgJqkW004Ap0Y2WSYmQRp8ECmnnkhejriBPOarh/VWD5CKgq2wigl9/BC5SoyUJEwOETRxdrIT1whXA8wh8nMF34doB6xYSmjkBKXiBVygI/6pcIzyihXjXRSzjT9NoEcjgzjzFZTUBrKTC3N+kYmycuUsgXH7wKmS6T6IWlRYeERuPijX7cSji4RF3yhNi/Xys1JGyC5MTw5X0VuV8SYTGwRfA/ngAAAABJRU5ErkJggg=='
    },
    
    
    FakeForm: function(ele){
      this.elements = [ele];
      ele.form = this;
      this.ownerDocument = ele.ownerDocument;
      this.action = ele.ownerDocument.URL;
      this.method = 'POST';
    }
	}
	
})();


