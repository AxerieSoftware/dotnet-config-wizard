import { expect, it } from 'vitest';
import { toFileTree } from './fileTree.ts';

it('lays files out by folder, with folders first and in-between folders that have no settings', () => {
	const tree = toFileTree(
		[{ path: '' }, { path: 'tests' }, { path: 'src/Legacy' }],
		[
			{ path: '.editorconfig', content: '' },
			{ path: 'tests/.editorconfig', content: '' },
			{ path: 'Directory.Build.props', content: '' }
		]
	);

	expect(tree.children.map(node => `${node.kind}:${node.name}`)).toEqual(['folder:src', 'folder:tests', 'file:.editorconfig', 'file:Directory.Build.props']);
	const src = tree.children[0];
	expect(src.kind === 'folder' && src.isScope).toBe(false);
	expect(src.kind === 'folder' && src.children.map(node => node.path)).toEqual(['src/Legacy']);
});
