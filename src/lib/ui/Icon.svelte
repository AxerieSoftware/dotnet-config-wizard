<script lang="ts" module>
	import arrowCounterclockwise from '@fluentui/svg-icons/icons/arrow_counterclockwise_20_regular.svg?raw';
	import arrowDownload from '@fluentui/svg-icons/icons/arrow_download_20_regular.svg?raw';
	import arrowLeft from '@fluentui/svg-icons/icons/arrow_left_20_regular.svg?raw';
	import arrowRight from '@fluentui/svg-icons/icons/arrow_right_20_regular.svg?raw';
	import box from '@fluentui/svg-icons/icons/box_20_regular.svg?raw';
	import checkmark from '@fluentui/svg-icons/icons/checkmark_20_regular.svg?raw';
	import checkmarkCircle from '@fluentui/svg-icons/icons/checkmark_circle_20_regular.svg?raw';
	import code from '@fluentui/svg-icons/icons/code_20_regular.svg?raw';
	import copy from '@fluentui/svg-icons/icons/copy_20_regular.svg?raw';
	import dismiss from '@fluentui/svg-icons/icons/dismiss_20_regular.svg?raw';
	import document from '@fluentui/svg-icons/icons/document_20_regular.svg?raw';
	import documentCheckmark from '@fluentui/svg-icons/icons/document_checkmark_20_regular.svg?raw';
	import errorCircle from '@fluentui/svg-icons/icons/error_circle_20_regular.svg?raw';
	import eye from '@fluentui/svg-icons/icons/eye_20_regular.svg?raw';
	import eyeOff from '@fluentui/svg-icons/icons/eye_off_20_regular.svg?raw';
	import folder from '@fluentui/svg-icons/icons/folder_20_regular.svg?raw';
	import folderAdd from '@fluentui/svg-icons/icons/folder_add_20_regular.svg?raw';
	import folderOpen from '@fluentui/svg-icons/icons/folder_open_20_regular.svg?raw';
	import globe from '@fluentui/svg-icons/icons/globe_20_regular.svg?raw';
	import info from '@fluentui/svg-icons/icons/info_20_regular.svg?raw';
	import link from '@fluentui/svg-icons/icons/link_20_regular.svg?raw';
	import panelLeftContract from '@fluentui/svg-icons/icons/panel_left_contract_20_regular.svg?raw';
	import panelLeftExpand from '@fluentui/svg-icons/icons/panel_left_expand_20_regular.svg?raw';
	import rocket from '@fluentui/svg-icons/icons/rocket_20_regular.svg?raw';
	import shieldCheckmark from '@fluentui/svg-icons/icons/shield_checkmark_20_regular.svg?raw';
	import textCaseTitle from '@fluentui/svg-icons/icons/text_case_title_20_regular.svg?raw';
	import textIndentIncrease from '@fluentui/svg-icons/icons/text_indent_increase_20_regular.svg?raw';
	import toolbox from '@fluentui/svg-icons/icons/toolbox_20_regular.svg?raw';
	import warning from '@fluentui/svg-icons/icons/warning_20_regular.svg?raw';
	import wrench from '@fluentui/svg-icons/icons/wrench_20_regular.svg?raw';

	/** Fluent UI System Icons used in the app, by name. */
	const ICONS = {
		arrowCounterclockwise,
		arrowDownload,
		arrowLeft,
		arrowRight,
		box,
		checkmark,
		checkmarkCircle,
		code,
		documentCheckmark,
		errorCircle,
		eye,
		eyeOff,
		folderOpen,
		globe,
		dismiss,
		copy,
		panelLeftExpand,
		panelLeftContract,
		folderAdd,
		document,
		folder,
		info,
		link,
		rocket,
		shieldCheckmark,
		textCaseTitle,
		textIndentIncrease,
		toolbox,
		warning,
		wrench
	};

	export type IconName = keyof typeof ICONS;
</script>

<script lang="ts">
	let { name, small = false }: { name: IconName; small?: boolean } = $props();
</script>

<!-- The SVGs come from the @fluentui/svg-icons package, not from user input. -->
<span class={['icon', small && 'small']} aria-hidden="true">{@html ICONS[name]}</span>
