import { describe, expect, it } from 'vitest';
import type { ScopeConfig, WizardConfig } from '../config/wizardConfig.ts';
import { findFormattingFallback } from './formattingFallback.ts';

function toConfig(...scopes: ScopeConfig[]): WizardConfig {
	return { versions: { sdkBand: '10.0.1xx' }, scopes };
}

describe('findFormattingFallback', () => {
	it('falls back to [*] in the same folder for a file type that leaves a key unset', () => {
		const root: ScopeConfig = { path: '', formatting: { '[*]': { indent_style: 'space' } } };

		expect(findFormattingFallback(toConfig(root), root, '[*.cs]', 'indent_style')).toEqual({ value: 'space', glob: '[*]', isInherited: false });
	});

	it('has no fallback for [*] itself at the repo root', () => {
		const root: ScopeConfig = { path: '', formatting: { '[*]': { indent_style: 'space' } } };

		expect(findFormattingFallback(toConfig(root), root, '[*]', 'indent_style')).toBeUndefined();
	});

	it("prefers a closer folder's [*] over the same file type in a folder above", () => {
		const root: ScopeConfig = { path: '', formatting: { '[*.cs]': { indent_size: '4' } } };
		const tests: ScopeConfig = { path: 'tests', formatting: { '[*]': { indent_size: '2' } } };

		expect(findFormattingFallback(toConfig(root, tests), tests, '[*.cs]', 'indent_size')).toEqual({ value: '2', glob: '[*]', isInherited: false });
	});

	it('prefers the same file type over [*] within a folder above', () => {
		const root: ScopeConfig = { path: '', formatting: { '[*]': { indent_size: '2' }, '[*.cs]': { indent_size: '4' } } };
		const tests: ScopeConfig = { path: 'tests' };

		expect(findFormattingFallback(toConfig(root, tests), tests, '[*.cs]', 'indent_size')).toEqual({ value: '4', glob: '[*.cs]', isInherited: true });
	});
});
