(function($) {
    var groupNode;
    var choiceIndex = [];
    var choices     = [];
    var stack       = [];
    var currentLang = "en"; // Default lang
    var rtlLangs    = {"ar": "","fa": ""};

    function detectRtl(value) {
      if (value in rtlLangs) {
        document.documentElement.dir = "rtl";
      } else {
        document.documentElement.dir = "ltr";
      }
    }

    function chooseNegativeResponse() {
        var responses = $('.negative').not('.visible');

        return responses[Math.floor(Math.random() * responses.length)];
    }

    function updateNegativeResponse() {
        var negative = chooseNegativeResponse();

        $($('.negative.visible')[0]).removeClass('visible');
        $(negative).addClass('visible');
    }

    function trackExternalLink() {
      window.ga('send', 'event', 'outbound', 'click', $('#ok')[0].firstChild.href);
    }

    function incrementAndWrap(curr, max) {
        if(max === undefined) {
          max = $('.choices li', groupNode).length;
        }
        curr++;
        if (curr === max) {
          curr = 0;
        }
        return curr;
    }

    function updateLocation(currChoice) {
        $('#location').html('');

        var pastStack = '#!/';
        for (var i = 0; i < stack.length; i++) {
            var choice = $('[next-group="' + stack[i] + '"]').first();
            var l10nId = choice.children('span').first().attr('data-l10n-id');

            pastStack += stack[i] + '/';

            var newLink = $('<a></a>').attr('href', pastStack).click(function () {
                window.location.href = $(this).attr('href');
                window.location.reload(true);
            });

            if (stack[i] === 'progornoprog') {
                newLink.text('~');
            } else {
                if (typeof l10nId === "undefined" && choice.text().trim().length > 0) {
                    //For a few choices (see next-group="js") the contents are set in HTML, not using l10n
                    newLink.text(choice.text().trim());
                } else if (document.webL10n.getReadyState() === 'complete') {
                    newLink.text(document.webL10n.get(l10nId));
                } else {
                    //If L10n hasn't loaded, we'll se the data-l10n-id attribute and wait for L10n to set it
                    newLink.attr('data-l10n-id', l10nId);
                }
            }

            $('#location').append(newLink).append(' / ');
        }

        $('#location').append($('<span></span>').text($(currChoice).text().split('\n')[0].trim()));
    }

    function updateCurrentChoice(lastIndex) {
        var lastChoice = $('.choices li', groupNode)[choices[choices.length - 1][lastIndex]];
        var choice     = $('.choices li', groupNode)[choices[choices.length - 1][choiceIndex[choiceIndex.length - 1]]];
        var nextChoice = $('.choices li', groupNode)[choices[choices.length - 1][incrementAndWrap(choiceIndex[choiceIndex.length - 1])]];

        updateNegativeResponse();
        lastChoice.style.display = 'none';
        choice.style.display = 'inline';
        var button = $('#ok')[0];
        button.removeEventListener('click', trackExternalLink);
        var isExternal = choice.hasAttribute('target');
        button.firstChild.href = !isExternal ?
            '#!/' + stack.join('/') + '/' + getUIDAttribute(choice) + '/' : choice.getAttribute('target');

        $('#next a:first').attr('href', '#!/' + stack.join('/') + '/' + getUIDAttribute(nextChoice));
        $('#back a:first').attr('href', '#!/' + stack.join('/', stack.slice(stack.length - 1, 1)));

        if (isExternal) {
          button.addEventListener('click', trackExternalLink);
        }
        setLocationHashSuffix(getUIDAttribute(choice));
        updateLocation(choice);
    }

    function nextChoice(ev) {
        if(ev.which === 2) {
          return;
        }
        ev.preventDefault();
        var lastIndex = choiceIndex[choiceIndex.length - 1];

        choiceIndex[choiceIndex.length - 1] = incrementAndWrap(lastIndex);
        updateCurrentChoice(lastIndex);
    }

    function switchGroup(group, choiceId) {
        groupNode = document.getElementById(group);

        if (!stack.length || stack[stack.length - 1] !== group || choiceId) {
          if ( $.inArray(group, stack) < 0 ) {
            stack.push(group);
          }

          if ( ! choiceId ) {
            choiceIndex.push(0);
          }

          setGroupChoices(group, choiceId);
        }

        var firstChoice = $('#wrapper > div')[0].id;
        $('#back')[0].style.display = group === firstChoice ? 'none' : 'block';
        $('#next')[0].style.display = group !== firstChoice && choices[choices.length - 1].length == 1 ? 'none' : 'block';
        $('.question', groupNode)[0].style.display = 'block';
        updateCurrentChoice(choiceIndex[choiceIndex.length - 1]);
    }

    function cleanUpCurrent() {
        if (!groupNode) {
            return;
        }
        $('.question', groupNode)[0].style.display = 'none';
        var lastChoice = $('.choices li', groupNode)[choices[choices.length - 1][choiceIndex[choiceIndex.length - 1]]];
        lastChoice.style.display = 'none';
    }

    function investigate(ev) {
        if(ev.which === 2) {
          return;
        }
        ev.preventDefault();
        var choice = $('.choices li', groupNode)[choices[choices.length - 1][choiceIndex[choiceIndex.length - 1]]];
        if (choice.hasAttribute('next-group')) {
            cleanUpCurrent();
            switchGroup(choice.getAttribute('next-group'));
        } else {
            window.open(choice.getAttribute('target'));
        }
    }

    function takeBack(ev) {
        if(ev.which === 2) {
          return;
        }
        cleanUpCurrent();
        setLocationHashSuffix("");
        stack.splice(stack.length - 1, 1);
        choiceIndex.splice(choiceIndex.length - 1, 1);
        choices.splice(choices.length - 1, 1);
        switchGroup(stack[stack.length - 1]);
    }

    function onLangChange() {
        document.webL10n.setLanguage(this.value);
        detectRtl(this.value);
        setLangQueryString(this.value)
    }

    function setLocationHashSuffix(value) {
        var midValue = stack.join("/");

        window.location.hash = "#!/" + midValue + "/" + value;
    }

    // Uses HTML5 pushState with fallback to window.location
    function setLangQueryString(value) {
        var urlPart = "?lang=" + value + window.location.hash;

        currentLang = value;

        if (supportsPushState()) {
          history.pushState({ lang: value, location: window.location.hash },
                            "", urlPart);
        } else {
          window.location = urlPart;
        }
    }

    function setGroupChoices(group, choiceId) {

        //+ Jonas Raoni Soares Silva
        //@ http://jsfromhell.com/array/shuffle [rev. #1]
        function shuffle(v) {
            for (var j, x, i = v.length; i; j = parseInt(Math.random() * i, 10), x = v[--i], v[i] = v[j], v[j] = x){}
            return v;
        }

        var collector = [],
            elements  = $('.choices li', groupNode),
            memo      = 0;

        for (var i = 0; i < elements.length; i++) {
            if (choiceId && getUIDAttribute(elements[i]) == choiceId) {
              memo = i;
            }

            collector.push(i);
        }

        collector = shuffle(collector)

        if (choiceId) {
          choiceIndex.push( $.inArray(memo, collector) );
        }

        choices.push(collector);
    }

    function getUIDAttribute(choice) {
      return choice.getAttribute("next-group") || choice.getAttribute("data-choice-id");
    }

    function supportsPushState() {
      return !! (window.history && history.pushState);
    }

    function supportsLang(value) {
      return !! $('#lang option[value=' + value + ']').length;
    }

    function changeLang(value) {
      var option = $('#lang option[value=' + value + ']');

      if (option.length) {
        // If the browser language is supported, select the good option

        document.webL10n.setLanguage(value);
        detectRtl(value);
        option.prop('selected', 'selected');

        currentLang = value;

        return currentLang;
      } else {
        return false;
      }
    }

    window.onpopstate = function(event) {
    }

    $(window).load(function() {
        $('#ok a:first').on('click', investigate);
        $('#next a:first').on('click', nextChoice);
        $('#back a:first').on('click', takeBack);
        $('#lang select').on('change', onLangChange);

        var languageRegexp = /[&?]lang=([^&?]+)/;
        var defaultGroup = "progornoprog";

        // Check for language part in URL
        if (languageRegexp.test(document.location.search)) {
          var testLang   = document.location.search.match(languageRegexp),
              langCode   = testLang[1];

          if (supportsLang(langCode)) {
            changeLang(langCode);
          }
        } else {
          // Using browser language if found

          // Detected browser language
          var browserLang = document.webL10n.getLanguage();
          // Default language (value of the selected <option> element)
          var defaultLang = currentLang;

          if (defaultLang !== browserLang && supportsLang(browserLang)) {
            changeLang(browserLang);
          } else {
            changeLang(defaultLang);
          }
        }

        // Check for permalink
        if (window.location.hash.length > 1) {
            var query      = window.location.hash,
                queryParts = query.split("/");

            window.ga('send', 'pageview', query);

            queryParts.shift(); // Dropping '#!'

            var savedGroup  = defaultGroup,
                savedChoice = queryParts.pop();

            cleanUpCurrent();

            stack = queryParts.length ? [defaultGroup] : [];
            if (queryParts.length) {
              stack = stack.concat(queryParts.slice(1, queryParts.length - 1));

              $.each(queryParts.slice(0, queryParts.length - 1), function(i, v) {
                groupNode = document.getElementById(v);
                setGroupChoices(v, queryParts[i + 1]);
              });

              savedGroup = queryParts.pop();
            }

            switchGroup(savedGroup, savedChoice);
        } else {
            switchGroup(defaultGroup);
        }
    });
})(window.jQuery);
