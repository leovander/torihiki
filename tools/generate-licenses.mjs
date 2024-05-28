/*
*	Torihiki - Message Forwarder and Notifier
*	Copyright (C) 2024 Israel Torres (https://github.com/leovander)

*	This program is free software: you can redistribute it and/or modify
*	it under the terms of the GNU Affero General Public License as published
*	by the Free Software Foundation, either version 3 of the License, or
*	(at your option) any later version.
*	
*	This program is distributed in the hope that it will be useful,
*	but WITHOUT ANY WARRANTY; without even the implied warranty of
*	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
*	GNU Affero General Public License for more details.
*	
*	You should have received a copy of the GNU Affero General Public License
*	along with this program. If not, see <https://www.gnu.org/licenses/>.
*/

import { writeFileSync } from 'fs';
import { init } from 'license-checker';

// eslint-disable-next-line no-undef
const PACKAGE_NAME = process.env.PACKAGE_NAME || 'NOT_DEFINED';

init({ start: '.', production: true }, (err, packages) => {
  if (err) {
    console.error(`Error: ${err}`);
    return;
  }

  const licensesMap = new Map();

  for (const [packageName, packageInfo] of Object.entries(packages)) {
    const license = packageInfo.licenses;
    const publisher = packageInfo.publisher || 'N/A';

    if (!packageName.startsWith(PACKAGE_NAME)) {
      if (!licensesMap.has(license)) {
        licensesMap.set(license, []);
      }

      licensesMap.get(license).push({ packageName, publisher });
    }
  }

  const output = [
    '# Third-Party Licenses',
    'This project includes the following third-party packages in the production build:',
  ];

  for (const [license, packages] of licensesMap.entries()) {
    output.push(`## License: ${license}`);
    packages.forEach(({ packageName, publisher }) => {
      output.push(`**${packageName}**\n\nPublisher: ${publisher}`);
    });
  }

  writeFileSync('LICENSES.md', output.join('\n\n'));
});
