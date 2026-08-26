import packageJson from '../../package.json';

const version = packageJson.version || '0.0.0';
var release = '';

if (packageJson.release.startsWith('Beta')) {
  release = 'Beta';
  console.warn(`You are running a Beta version (${version} ${release}). Expect bugs and instability. Please report any issues you encounter.`);
}

if (packageJson.release.startsWith('Alpha')) {
  release = 'Alpha';
  console.warn(`You are running an Alpha version (${version} ${release}). Expect significant bugs and instability. Please report any issues you encounter.`);
}

if (packageJson.release.startsWith('Stable')) {
  release = '';
}

const ManagerVersion = version.startsWith('0.') ? `${version} ${release}` : version;
export default ManagerVersion;
