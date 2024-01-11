/**
 * Extend the base Token class to implement additional system-specific logic.
 */
export default class TokenPbta extends Token {
	_drawBar(number, bar, data) {
		if (data) {
			const system = this.actor.system;
			const type = foundry.utils.getProperty(system, data.attribute).type;
			if (type === "Clock") {
				data.value = (data.max - data.value);
				const val = Number(data.value);
				const pct = Math.clamped(val, 0, data.max) / data.max;

				// Determine sizing
				let h = Math.max((canvas.dimensions.size / 12), 8);
				const w = this.w;
				const bs = Math.clamped(h / 8, 1, 2);
				if (this.document.height >= 2) h *= 1.6;  // Enlarge the bar for large tokens

				// Determine the color to use
				const blk = 0x000000;
				let color;
				if (number === 0) color = Color.fromRGB([(1-(pct/2)), pct, 0]);
				else color = Color.fromRGB([(0.5 * pct), (0.7 * pct), 0.5 + (pct / 2)]);

				// Draw the bar
				bar.clear();
				bar.beginFill(blk, 0.5).lineStyle(bs, blk, 1.0)
					.drawRoundedRect(0, 0, this.w, h, 3);
				bar.beginFill(color, 1.0).lineStyle(bs, blk, 1.0)
					.drawRoundedRect(0, 0, pct*w, h, 2);

				// Set position
				let posY = number === 0 ? this.h - h : 0;
				bar.position.set(0, posY);
				return true;
			}
			return super._drawBar(number, bar, data);
		}
	}
}
