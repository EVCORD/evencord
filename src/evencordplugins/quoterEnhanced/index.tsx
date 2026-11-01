/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings, migratePluginSettings } from "@api/Settings";
import { FormSwitch } from "@components/FormSwitch";
import { Link } from "@components/Link";
import { Paragraph } from "@components/Paragraph";
import { Devs, EquicordDevs } from "@utils/constants";
import { getCurrentChannel } from "@utils/discord";
import definePlugin, { OptionType } from "@utils/types";
import { Message, RenderModalProps } from "@vencord/discord-types";
import { IconUtils, Menu, MessageStore, Modal, openModal, TextInput, UploadHandler, useEffect, useRef, useState } from "@webpack/common";

import { QuoteIcon } from "./components/QuoteIcon";
import { getQuoteMedia, MediaMessage, refreshQuoteMedia, resolveMissingPageMedia } from "./media";
import { QuoteFont } from "./types";
import { createQuoteImage, ensureFontLoaded, generateFileNamePreview, resetFontLoading } from "./utils";

const settings = definePluginSettings({
    quoteFont: {
        type: OptionType.SELECT,
        description: "Font for the quote text",
        options: [
            { label: "M PLUS Rounded 1c", value: QuoteFont.MPlusRounded, default: true },
            { label: "Open Sans", value: QuoteFont.OpenSans },
            { label: "Momo Signature", value: QuoteFont.MomoSignature },
            { label: "Lora", value: QuoteFont.Lora },
            { label: "Merriweather", value: QuoteFont.Merriweather },
            { label: "Cairo (Arabic)", value: QuoteFont.Cairo },
            { label: "Tajawal (Arabic)", value: QuoteFont.Tajawal }
        ]
    },
    quotationMarks: { type: OptionType.BOOLEAN, description: "Add quotation marks around text.", default: true },
    allowMedia: { type: OptionType.BOOLEAN, description: "Include images, videos and stickers in quotes", default: true },
    watermark: { type: OptionType.STRING, description: "Custom watermark text (max 32 characters)", default: "Made with EvenCord" },
    grayscale: { type: OptionType.BOOLEAN, description: "Default grayscale state", default: true, hidden: true },
    showWatermark: { type: OptionType.BOOLEAN, description: "Default watermark visibility", default: false, hidden: true },
    saveAsGif: { type: OptionType.BOOLEAN, description: "Automatically preserve animation", default: true, hidden: true }
});

migratePluginSettings("Quoter Enhanced", "Quoter");

export default definePlugin({
    name: "Quoter Enhanced",
    searchTerms: ["Quoter", "Valenced", "quotes", "GIF"],
    description: "اقتباسات مصورة تدعم الخطوط العربية والصور والوسائط المتحركة.",
    tags: ["Chat"],
    authors: [Devs.Samwich, Devs.thororen, EquicordDevs.neoarz, Devs.prism],
    settings,
    settingsAboutComponent: () => <section dir="rtl" lang="ar">
        <Paragraph>من قائمة الرسالة اختر Quote، راجع المعاينة ثم اضغط Send. اختر Cairo أو Tajawal للنص العربي.</Paragraph>
        <Paragraph>المصدر الأصلي: <Link href="https://github.com/Equicord/Equicord/tree/main/src/equicordplugins/quoter">Quoter في Equicord</Link>. مرجع التصميم والوسائط: <Link href="https://github.com/Accentaro/Valenced-Plugins/tree/main/plugins/quoter">Valenced Quoter</Link>.</Paragraph>
    </section>,
    async start() { await ensureFontLoaded(); },
    stop() {
        document.getElementById("quoter-font-style")?.remove();
        resetFontLoading();
    },
    contextMenus: {
        "message": (children, { message }) => {
            const m: MediaMessage = message;
            if (!message.content && !m.attachments?.length && !m.stickerItems?.length && !m.embeds?.length) return;
            children.push(<Menu.MenuItem
                id="vc-quote" label="Quote" icon={QuoteIcon}
                leadingAccessory={{ type: "icon", icon: QuoteIcon }}
                action={() => openModal(props => <QuoteModal message={message} {...props} />)}
            />);
        }
    }
});

function QuoteModal({ message, ...props }: RenderModalProps & { message: Message; }) {
    const [allowMedia, setAllowMedia] = useState(settings.store.allowMedia);
    const [gray, setGray] = useState(settings.store.grayscale);
    const [showWatermark, setShowWatermark] = useState(settings.store.showWatermark);
    const [saveAsGif, setSaveAsGif] = useState(settings.store.saveAsGif);
    const [quotationMarks, setQuotationMarks] = useState(settings.store.quotationMarks);
    const [watermarkText, setWatermarkText] = useState(settings.store.watermark);
    const [quoteImage, setQuoteImage] = useState<Blob | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [warnings, setWarnings] = useState<string[]>([]);
    const [rendering, setRendering] = useState(false);
    const requestId = useRef(0);
    const { quoteFont } = settings.store;

    useEffect(() => {
        settings.store.allowMedia = allowMedia;
        settings.store.grayscale = gray;
        settings.store.showWatermark = showWatermark;
        settings.store.saveAsGif = saveAsGif;
        settings.store.quotationMarks = quotationMarks;
    }, [allowMedia, gray, showWatermark, saveAsGif, quotationMarks]);

    useEffect(() => {
        let abandoned = false;
        const controller = new AbortController();
        const renderWarnings: string[] = [];
        const warn = (message: string) => { if (!renderWarnings.includes(message)) renderWarnings.push(message); };
        const request = ++requestId.current;
        const run = async () => {
            setRendering(true);
            setError("");
            setWarnings([]);
            setQuoteImage(null);
            setPreviewUrl(null);
            try {
                const original: MediaMessage = MessageStore.getMessage(message.channel_id, message.id) ?? message;
                let media = allowMedia ? getQuoteMedia(original) : [];
                if (allowMedia) media = await refreshQuoteMedia(media, warn, controller.signal);
                if (allowMedia) media = await resolveMissingPageMedia(original, media, warn, controller.signal);
                const image = await createQuoteImage({
                    avatarUrl: IconUtils.getUserAvatarURL(message.author, true, 512),
                    quote: original.content ?? "",
                    message: allowMedia ? original : undefined,
                    media,
                    onWarning: warn,
                    signal: controller.signal,
                    grayScale: gray,
                    author: message.author,
                    watermark: watermarkText,
                    showWatermark,
                    saveAsGif,
                    quoteFont,
                    showQuoteMark: quotationMarks
                });
                if (abandoned || request !== requestId.current) return;
                setQuoteImage(image);
                setPreviewUrl(URL.createObjectURL(image));
            } catch (e) {
                if (!abandoned && request === requestId.current) setError(String(e instanceof Error ? e.message : e));
            } finally {
                if (!abandoned && request === requestId.current) {
                    setWarnings(renderWarnings);
                    setRendering(false);
                }
            }
        };
        void run();
        return () => { abandoned = true; controller.abort(); };
    }, [allowMedia, gray, showWatermark, saveAsGif, quotationMarks, watermarkText, quoteFont, message]);

    useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

    const filename = `${generateFileNamePreview(message.content || "quote") || "quote"} - ${message.author.username}.${quoteImage?.type === "image/gif" ? "gif" : "png"}`;
    const handleExport = () => {
        if (!quoteImage || rendering) return;
        const url = URL.createObjectURL(quoteImage);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 3000);
    };
    const handleSendInChat = () => {
        if (!quoteImage || rendering) return;
        const channel = getCurrentChannel();
        if (!channel) return;
        const file = new File([quoteImage], filename, { type: quoteImage.type });
        UploadHandler.promptToUpload([file], channel, 0);
        props.onClose?.();
    };
    return (
        <Modal
            {...props}
            size="md"
            title="Quoter Enhanced"
            actions={[
                { text: "Export", variant: "primary", onClick: handleExport },
                { text: "Send", variant: "primary", onClick: handleSendInChat }
            ]}
        >
            {previewUrl && <img alt="Quote preview" src={previewUrl} style={{ borderRadius: "12px", width: "100%", marginBottom: "16px" }} />}
            {rendering && <div style={{ padding: "10px 0", color: "#aaa" }}>Rendering quote / animated media…</div>}
            {error && <div style={{ color: "#f38ba8", padding: "8px 0", whiteSpace: "pre-wrap" }}>Quote failed: {error}</div>}
            {warnings.map(warning => <div key={warning} style={{ color: "#f9e2af", padding: "8px 0", whiteSpace: "pre-wrap" }}>{warning}</div>)}
            <FormSwitch title="Quotation marks" value={quotationMarks} onChange={setQuotationMarks} />
            <FormSwitch title="Include media and stickers" value={allowMedia} onChange={setAllowMedia} />
            <FormSwitch title="Grayscale" value={gray} onChange={setGray} />
            <FormSwitch title="Preserve animation (GIF)" value={saveAsGif} onChange={setSaveAsGif} description="Preserve animation from GIF, APNG, WebP and supported video media" />
            <FormSwitch title="Show Watermark" value={showWatermark} onChange={setShowWatermark} hideBorder={showWatermark} />
            {showWatermark && <div style={{ margin: "8px 0 20px" }}><TextInput value={watermarkText} onChange={setWatermarkText} maxLength={32} /></div>}
        </Modal>
    );
}
