"use strict";
import fs from 'fs';

export function settings_configure(electron_settings, directory, file) {
  let dir_ok = false;
  let file_ok = false;
  if (directory !== undefined && (typeof(directory) === 'string') && fs.existsSync(directory)) {
    dir_ok = true;
  }
  if (file !== undefined && (typeof(file) === 'string')) {
    file_ok = true;
  }
  if (dir_ok && file_ok) {
    electron_settings.configure({fileName: file, dir: directory});
  } else if (dir_ok) {
    electron_settings.configure({dir: directory});
  } else if (file_ok) {
    electron_settings.configure({fileName: file});
  }
  electron_settings.configure({prettify: true, numSpaces: 2});
}
