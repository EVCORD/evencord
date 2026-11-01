/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { Paragraph } from "@components/Paragraph";
import { Project } from "@shared/project";
import type { CSSProperties } from "react";

import { CAPTURE_KEYS, settings, videoOptions } from "./settings";
import type { CaptureStatus } from "./types";

export function duration(seconds: number) {
    return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}

export function ClipIcon({ className, recording = false, busy = false }: { className?: string; recording?: boolean; busy?: boolean; }) {
    return <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5.3 6.1A8.5 8.5 0 1 1 3.5 12M5.3 2.8v3.7H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        {recording || busy
            ? <circle cx="12" cy="12" r="3.5" fill={busy ? "var(--status-warning)" : "var(--status-danger)"} />
            : <path d="m10 8.5 6 3.5-6 3.5z" fill="currentColor" />}
    </svg>;
}

interface ControlsProps {
    capture: CaptureStatus & { busy: string; lastSaved?: string; };
    toggle(): void;
    save(): void;
    openFolder(): void;
    showLastClip(): void;
}

export function Controls({ capture, toggle, save, openFolder, showLastClip }: ControlsProps) {
    settings.use(CAPTURE_KEYS);
    const profile = videoOptions();
    const target = capture.active ? capture.targetSeconds ?? profile.seconds : profile.seconds;
    const fill = Math.min(100, capture.seconds / target * 100);
    const estimatedMiB = (profile.bitrate + 128_000) / 8 * profile.seconds / 1024 / 1024;
    return <section className="vc-reclip-panel" aria-label="Reclip recorder" style={{ "--reclip-accent": Project.colors.primary } as CSSProperties}>
        <div className="vc-reclip-heading">
            <ClipIcon recording={capture.active} busy={Boolean(capture.busy)} />
            <div className="vc-reclip-brand"><strong>Reclip</strong></div>
            <span className="vc-reclip-status" data-recording={capture.active}>{capture.busy || (capture.active ? "Recording" : "Ready to record")}</span>
        </div>
        <div className="vc-reclip-timeline">
            <span>{duration(capture.seconds)} available</span><span>{duration(target)} target</span>
        </div>
        <div className="vc-reclip-progress" role="progressbar" aria-label="Available clip duration" aria-valuemin={0} aria-valuemax={target}
            aria-valuenow={Math.min(target, Math.floor(capture.seconds))} aria-valuetext={`${duration(capture.seconds)} of ${duration(target)}`}>
            <div style={{ width: `${fill}%` }} />
        </div>
        {capture.active ? <Paragraph>
            {capture.resolution || "Preparing video"}{capture.fps ? ` at up to ${capture.fps} fps` : ""}.
            {` Buffer: ${Math.round(capture.memoryMiB ?? 0)} / ${capture.memoryLimitMiB ?? profile.memoryMiB} MiB.`}
        </Paragraph> : null}
        {capture.microphone ? <Paragraph>Microphone: {capture.microphone}</Paragraph> : null}
        <div className="vc-reclip-actions">
            <Button variant={capture.active ? "dangerSecondary" : "primary"} disabled={Boolean(capture.busy)} onClick={toggle}>
                {capture.active ? "Stop recording" : "Start recording"}
            </Button>
            <Button disabled={!capture.active || Boolean(capture.busy)} onClick={save}>Save {settings.store.exportFormat.toUpperCase()} clip</Button>
            <Button variant="secondary" onClick={openFolder}>Open clips</Button>
            {capture.lastSaved ? <Button variant="secondary" onClick={showLastClip}>Show last clip</Button> : null}
        </div>
        {capture.error ? <div role="alert" className="vc-reclip-error">{capture.error}</div> : null}
        {capture.shortened ? <Paragraph>The memory limit shortened the available clip. Choose a lower bitrate or a larger buffer for the next recording.</Paragraph> : null}
        {estimatedMiB > profile.memoryMiB * 0.9 ? <Paragraph>
            Your selected duration and quality may exceed this buffer limit. Lower the bitrate or increase the memory limit to keep more footage.
        </Paragraph> : null}
        <Paragraph>Keep the last {duration(target)} of Discord ready to save. No game or screen share required. Recording changes apply when you next start the buffer; the save format applies to your next clip.</Paragraph>
        <section dir="rtl" lang="ar">
            <Paragraph><strong>كيف تستخدم Reclip؟</strong> شغّل Start recording قبل اللحظة التي تريد الاحتفاظ بها. تحتفظ الإضافة بآخر دقيقتين افتراضياً بدلاً من تسجيل جلسة طويلة كاملة؛ يمكنك اختيار مدة من دقيقة إلى 30 دقيقة. لا يمكن استرجاع لحظات سبقت تشغيل التسجيل.</Paragraph>
            <Paragraph>زر السهم بجانب أدوات المستخدم يشغّل التسجيل ويصبح أحمر عند نشاطه. اضغطه أثناء التسجيل لحفظ آخر اللحظات مع استمرار التسجيل، أو استخدم Save clip هنا. افتراضياً Ctrl+Alt+F9 للتشغيل والإيقاف وCtrl+Alt+F10 للحفظ؛ استخدم اختصاراتك المعدلة إن غيرتها. بزر الفأرة الأيمن على السهم يمكنك الحفظ أو الإيقاف أو فتح المجلد.</Paragraph>
            <Paragraph><strong>ما الذي يُسجَّل؟</strong> صورة نافذة Discord الرئيسية فقط على Windows، وليس سطح المكتب أو الألعاب أو النوافذ المنبثقة المنفصلة. لا تحتاج مشاركة شاشة. صوت النظام قد يشمل تطبيقات أخرى على مخرج Windows الافتراضي؛ اجعل Discord يستخدم ذلك المخرج. الميكروفون مستقل عن كتم Discord وPush to Talk: اختر Microphone off لاستبعاده. يمكنك اختيار الميكروفون وضبط مستوى كل مصدر أو تعطيل المصدرين لفيديو صامت.</Paragraph>
            <Paragraph><strong>الجودة والحفظ:</strong> Balanced مناسب غالباً، وLight أخف للأجهزة الضعيفة، وتتوفر إعدادات أعلى حتى 1080p و60 إطاراً كحد أقصى حسب الجهاز. تُحفظ المقاطع محلياً في Videos/Reclip أو مجلد تختاره، دون رفع تلقائي. WebM وMKV يُحفظان مباشرة؛ MP4 يحتاج FFmpeg لتحويل المقطع محلياً، ويمكن اختيار ffmpeg.exe من الإعدادات. عند فشل التحويل يُحتفظ بملف WebM.</Paragraph>
            <Paragraph><strong>قبل الإيقاف:</strong> احفظ اللقطة أولاً؛ الإيقاف أو إغلاق Discord يمسح التسجيل المؤقت غير المحفوظ. قد تكون اللقطات أقصر أثناء امتلاء الذاكرة المؤقتة أو عند بلوغ حدها، وقد تتجمد الصورة عند تصغير Discord أو قفل الجهاز. تغييرات المدة والجودة والصوت تحتاج إيقاف التسجيل وتشغيله من جديد، بينما صيغة الحفظ تطبق على المقطع التالي. المقاطع المحفوظة سابقاً لا تُحذف تلقائياً.</Paragraph>
        </section>
        {!settings.store.showIcon ? <Paragraph>The replay button is hidden. Use these controls or your global shortcuts to record and save.</Paragraph> : null}
        {profile.fps === 60 ? <Paragraph>60 fps is a maximum, not a guarantee. Smooth motion uses more processing power; Balanced is better for mostly static conversations.</Paragraph> : null}
        {settings.store.exportFormat === "mp4" ? <Paragraph>MP4 converts locally after saving. This takes extra time and CPU while the recording buffer continues. Choose ffmpeg.exe in Reclip settings if it is not detected automatically.</Paragraph> : null}
        <details className="vc-reclip-details">
            <summary>Audio and saving details</summary>
            <Paragraph>Speaker audio can include other apps. Use the Windows default output for Discord. Your microphone records independently of Discord mute and push to talk; choose Microphone off to exclude it.</Paragraph>
            <Paragraph>Choose a save folder in settings. The default remains Videos/Reclip. WebM and MKV include seek indexes and save directly without conversion. MP4 converts to H.264 and AAC using FFmpeg. Conversion failures preserve the WebM and show a warning.</Paragraph>
            <Paragraph>Early clips are shorter, and exports start at the nearest usable video keyframe. Stopping discards unsaved footage. The buffer limit covers encoded video; total process memory is higher, especially during saves.</Paragraph>
        </details>
    </section>;
}
