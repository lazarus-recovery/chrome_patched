
(function(ns){

  var locale = ns.locale = {
	
		NODE_TYPE_ELE: 1,
		
		NODE_TYPE_TEXT: 3,
    
    defaultLang: 'en',
		
		currentLocale: '',
    
    regionalLocale: '',
    
    primaryLocale: '',
    
    strings: {},

    setLocale: function(langCode){
      var m = langCode.toLowerCase().match(/^([a-z]{2})(-[A-Z]{2})?$/i);
      if (m){
        this.regionalLocale = langCode;
        this.primaryLocale = m[1] || '';
				if (this.strings[this.regionalLocale]){
					this.currentLocale = this.regionalLocale;
				}
				else if (this.strings[this.primaryLocale]){
					this.currentLocale = this.primaryLocale;
				}
				else {
					this.currentLocale = this.defaultLang;
				}
      }
      else {
        throw Error("Invalid language code '"+ langCode +"' language code must be of the form aa (eg 'en') or aa-AA (eg 'en-US')");
      }
    },
    
    
    setStrings: function(strings){
      for(var id in strings){
        this.strings[this.defaultLang][id] = strings[id].toString();
      }
    },

    getString: function(id, replacements, suppressError){
    
      //use the regional language if possible
      var str = null;
			if (this.strings[this.regionalLocale] && (typeof this.strings[this.regionalLocale][id] == "string")){
        str = this.strings[this.regionalLocale][id];
      }
      //fallback to the primary language if the regional translation doesn't exist
      else if (this.strings[this.primaryLocale] && (typeof this.strings[this.primaryLocale][id] == "string")){
        str = this.strings[this.primaryLocale][id];
      }
      //or the default language if no other appropriate translation exists
      else if (this.strings[this.defaultLang] && (typeof this.strings[this.defaultLang][id] == "string")){
        str = this.strings[this.defaultLang][id];
      }
      
      if (typeof str == "string"){
        str = locale.localiseText(str);
        return replacements ? locale.replace(str, replacements) : str;
      }
      //id not found
      //sometimes we shouldn't throw an error here (our id might have been generated using user submitted data)
      else if (suppressError){
        return '';
      }
      else {
        throw Error("locale string not found '"+ id +"'");
      }
    },
    
    replace: function(str, replacements){
      
      //then replace any replacements that have been passed as arguments
      return str.replace(/\{\w+\}/g, function(m){
				var key = m.replace(/\{|\}/g, '');
				if (replacements && typeof replacements[key] != "undefined"){
					return replacements[key];
				}
				else {
          //log the error, but continue anyway (non-fatal error)
          //console.error("locale: missing replacement in string '"+ str +"'", replacements);
				}
			});
      
      
      
    },
		
		/*
		Substitute {curly-braced} variables found in an a document
		*/
		localiseDOM: function(doc){
			locale.localiseTitle(doc);
			locale.localiseEle(doc.body);
		},
		
		localiseTitle: function(doc){
			var newTitle = locale.localiseText(doc.title);
			if (doc.title != newTitle){
				doc.title = newTitle;
			}
		},
		
		
		localiseEle: function(ele){
			//translate any attributes
			
			//ignore certain element types
			//NOTE: we're only going to ignore their childNodes, not any attributes of the element
			var ignoreEles = ["script", "style", "textarea"];

			//Localise attributes
			//list of attributes to inspect
			var attrs = ["title", "alt"];
			if (ele.tagName.toLowerCase() == "input" && ele.getAttribute("type").match(/submit|button|reset/)){
				attrs.push("value");
			}
			
			for(var i=0; i<attrs.length; i++){
				var attr = attrs[i];
			  var currText = ele.getAttribute(attr);
				if (currText){
					var newText = locale.localiseText(currText);
					if (currText != newText){
						ele.setAttribute(attr, newText);
					}
				}
			}
			
			//Localize text nodes
			var tagname = ele.tagName.toLowerCase();
			if (ignoreEles.indexOf(tagname) == -1){
				for(var i=0; i<ele.childNodes.length; i++){
				  var child = ele.childNodes[i];
					if (child.nodeType == locale.NODE_TYPE_TEXT){
						if (child.nodeValue.indexOf("{") > -1){
							var currText = child.nodeValue;
							var newText = locale.localiseText(currText);
							if (currText != newText){
                //XXX TODO? hmm, is there any reason why we just don't use innerHTML for ALL childNode localisation?
                //we'd have to make sure the element only contained a single child node, but otherwise why not?
                //security shouldn't be a problem unless we're doing localisation using user input
                //would this allow us to use proper substitutions (eg <p>{email address is <a href="mailto:{email}">{email}</a>}</p>)
                //but would make doing the substitution a tad harder.
                //unneeded for now, but something to look at in the future maybe?
                if (currText.match(/\{[^\}]+,\s*html\b/)){
                  ele.innerHTML = newText;
                }
                else {
                  child.nodeValue = newText;
                }
							}
						}
					}
					else if (child.nodeType == locale.NODE_TYPE_ELE){
						locale.localiseEle(child);
					}
				}
			}
		},
		
		//replace {curlybraced} variables found in the text
		localiseText: function(text){
			return text.replace(/\{\w+\.[\w\-\.\,]+\}/g, function(m){      
        var key = m.replace(/\{|\}|,.*$/g, '');
        var newText = locale.getString(key);
        if (newText.indexOf("{") > -1){
          newText = locale.localiseText(newText);
        }
        return newText;
			});
		}
  }

})(Lazarus);