'use strict'
import { vqlValidate } from './vql-search.js'
import { searchTooltip } from './reqm2oreqm.js'

/** When true only search ID field */
export let searchLanguage = 'reg' // search language
/** regex for matching requirements */
export let searchPattern = ''
/** initial set of excluded doctypes */
export let excludedDoctypes = []

export function setExcludedDoctypes (ed) {
  excludedDoctypes = ed
}

export function setSearchPattern (patt) {
  searchPattern = patt
}

export function setSearchLanguage (lang) {
  searchLanguage = lang
}

function searchValidate (str) {
  switch(searchLanguage) {
    case 'ids':
    case 'reg':
      try {
        // eslint-disable-next-line no-unused-vars
        let _regexRule = new RegExp(str)
      } catch (err) {
        return err.message
      }
      break

    case 'vql':
      return vqlValidate(str)
  }
  return null
}

/**
 * Check if content of field is OK
 * @param {DOM object} field
 * @returns true if field OK
 */
 export function searchRegexValidate (field) {
  let text = field.value
  let validationError = searchValidate(text)
  if (text && validationError) {
    if (!field.errorbox) {
      const rect = field.getBoundingClientRect();
      const left = rect.left;
      const top = rect.bottom;
      const width = field.clientWidth
      field.errorbox = document.createElement('div');
      field.errorbox.innerHTML = validationError
      field.errorbox.classList.add('search_terms')
      field.errorbox.setAttribute('style', `background: #f0a0a0;
                                            padding: 6px;
                                            position: absolute;
                                            top: ${top}px;
                                            left: ${left}px;
                                            width: ${width}px;
                                            border: 2px solid #ff0000;
                                            font-family: 'Courier New', monospace;
                                            `);
      field.errorbox.style.fontSize = "75%"
      field.parentNode.appendChild(field.errorbox);
    } else {
      field.errorbox.innerHTML = validationError;
      field.errorbox.style.display = 'block';
    }
  } else if (field.errorbox) {
    field.errorbox.style.display = 'none';
  }
  return !(text && validationError)
}

export function setSearchLanguageHints (lang) {
  let input = document.getElementById('search_regex')
  switch (lang) {
    case 'vql':
      input.placeholder = "VQL search\nrem: or chg: or new: select changes\nAND, OR, NOT and ( ) operators\nan() pa() de() ch() selections"
      break
    case 'reg':
    case 'ids':
      input.placeholder = "Regex search\nnewlines are ignored\nrem:|chg:|new: select changes"
      break
  }
  document.getElementById('search_tooltip').innerHTML = searchTooltip(lang)
}

/**
 * Update radio-button for language selection as well as searchLanguage variable
 * @param {string} lang 'ids', 'req' or 'vql' from cmd line, settings or context file
 */
 export function setSearchLanguageButtons (lang) {
  switch (lang) {
    case 'ids':
      document.getElementById('id_radio_input').checked = true
      break
    case 'reg':
      document.getElementById('regex_radio_input').checked = true
      break
    case 'vql':
      document.getElementById('vql_radio_input').checked = true
      break
    }
    setSearchLanguage(lang)
    setSearchLanguageHints(lang)
  }

/**
 * Get the regular expression from "Selection criteria" box
 * @return {string} regular expression
 */
 export function getSearchRegexClean () {
  const rawSearch = document.getElementById('search_regex').value
  let cleanSearch
  if (searchLanguage === 'vql') {
    cleanSearch = rawSearch
  } else {
    cleanSearch = rawSearch.replace(/\n/g, '') // ignore all newlines in regex
  }
  return cleanSearch
}

