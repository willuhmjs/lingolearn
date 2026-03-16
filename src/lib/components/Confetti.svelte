<script lang="ts">
	import { onMount } from 'svelte';

	let { trigger = false, duration = 3000 }: { trigger?: boolean; duration?: number } = $props();

	interface Particle {
		x: number;
		y: number;
		vx: number;
		vy: number;
		rotation: number;
		rotationSpeed: number;
		color: string;
		size: number;
		opacity: number;
	}

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D | null;
	let particles: Particle[] = [];
	let animationId: number;

	const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

	function createParticle(): Particle {
		const angle = Math.random() * Math.PI * 2;
		const velocity = 5 + Math.random() * 10;

		return {
			x: window.innerWidth / 2,
			y: window.innerHeight / 2,
			vx: Math.cos(angle) * velocity,
			vy: Math.sin(angle) * velocity - 5,
			rotation: Math.random() * 360,
			rotationSpeed: (Math.random() - 0.5) * 20,
			color: colors[Math.floor(Math.random() * colors.length)],
			size: 8 + Math.random() * 8,
			opacity: 1
		};
	}

	function animate() {
		if (!ctx || !canvas) return;

		ctx.clearRect(0, 0, canvas.width, canvas.height);

		particles = particles.filter((p) => {
			// Update physics
			p.vy += 0.5; // gravity
			p.x += p.vx;
			p.y += p.vy;
			p.rotation += p.rotationSpeed;
			p.opacity -= 0.01;

			// Remove if off screen or faded
			if (p.y > canvas.height || p.opacity <= 0) return false;

			// Draw particle
			ctx!.save();
			ctx!.globalAlpha = p.opacity;
			ctx!.translate(p.x, p.y);
			ctx!.rotate((p.rotation * Math.PI) / 180);
			ctx!.fillStyle = p.color;
			ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size / 3);
			ctx!.restore();

			return true;
		});

		if (particles.length > 0) {
			animationId = requestAnimationFrame(animate);
		}
	}

	function startConfetti() {
		if (!ctx) return;

		// Create 100 particles
		for (let i = 0; i < 100; i++) {
			particles.push(createParticle());
		}

		animate();

		// Auto-stop after duration
		setTimeout(() => {
			particles = [];
			if (animationId) {
				cancelAnimationFrame(animationId);
			}
		}, duration);
	}

	$effect(() => {
		if (trigger && ctx) {
			startConfetti();
		}
	});

	onMount(() => {
		if (!canvas) return;

		ctx = canvas.getContext('2d');
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;

		const handleResize = () => {
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;
		};

		window.addEventListener('resize', handleResize);

		return () => {
			window.removeEventListener('resize', handleResize);
			if (animationId) {
				cancelAnimationFrame(animationId);
			}
		};
	});
</script>

<canvas bind:this={canvas} class="confetti-canvas" aria-hidden="true"></canvas>

<style>
	.confetti-canvas {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: 9999;
	}
</style>
