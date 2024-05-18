import { randomInt } from 'node:crypto';
import * as fs from 'node:fs';

const AUDIO_PATH = 'assets/audio';
const SEPARATOR = '/';

interface AudioFilePath {
  fullPath: string,
  extension: string,
}

interface Category {
  [key: string]: AudioFilePath
}

interface Categories {
  [key: string]: Category
}

class AudioFiles {
  categories: Categories;

  constructor() {
    this.categories = {};

    const paths = fs.readdirSync(AUDIO_PATH, {
      recursive: true,
      withFileTypes: true
    });

    paths
      .filter((fsDirent: fs.Dirent) => fs.lstatSync(`${fsDirent.parentPath}${SEPARATOR}${fsDirent.name}`).isDirectory())
      .forEach((folder: fs.Dirent) => {
        this.categories[folder.name] = {};  
      });
    
    paths
      .filter((fsDirent: fs.Dirent) => fs.lstatSync(`${fsDirent.parentPath}${SEPARATOR}${fsDirent.name}`).isFile())
      .forEach((file: fs.Dirent) => {
        const category = file.parentPath.slice(file.parentPath.lastIndexOf(SEPARATOR) + 1);
        const [ name, extension ] = file.name.split('.');

        this.categories[category][name] = {
          extension,
          fullPath: `${file.parentPath}${SEPARATOR}${file.name}`
        }  
      });
  }

  random(category: string): AudioFilePath {
    const files = Object.keys(this.categories[category]);
    const random = files[randomInt(files.length)];
    return this.categories[category][random];
  }
}

export const audioFiles = new AudioFiles();