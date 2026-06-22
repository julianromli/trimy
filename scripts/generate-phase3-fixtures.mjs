/**
 * Generate Phase 3 E2E fixtures with known silence gaps.
 * Usage: bash scripts/generate-phase3-fixtures.sh
 */
import { execSync } from "node:child_process";

const fixtures = [
	{
		path: "/tmp/trimy-phase3-silence.wav",
		filter:
			"aevalsrc=0.2*sin(2*PI*220*t):d=6:s=16000:c=mono[s1];" +
			"aevalsrc=0:d=2:s=16000:c=mono[gap1];" +
			"aevalsrc=0.2*sin(2*PI*330*t):d=6:s=16000:c=mono[s2];" +
			"aevalsrc=0:d=2:s=16000:c=mono[gap2];" +
			"aevalsrc=0.2*sin(2*PI*440*t):d=6:s=16000:c=mono[s3];" +
			"aevalsrc=0:d=2:s=16000:c=mono[gap3];" +
			"aevalsrc=0.2*sin(2*PI*520*t):d=6:s=16000:c=mono[s4];" +
			"aevalsrc=0:d=2:s=16000:c=mono[gap4];" +
			"aevalsrc=0.2*sin(2*PI*620*t):d=6:s=16000:c=mono[s5];" +
			"[s1][gap1][s2][gap2][s3][gap3][s4][gap4][s5]concat=n=9:v=0:a=1[out]",
	},
];

for (const fixture of fixtures) {
	execSync(
		`ffmpeg -y -f lavfi -i anullsrc=r=16000:cl=mono -filter_complex "${fixture.filter}" -map "[out]" -t 40 ${fixture.path}`,
		{ stdio: "inherit" },
	);
	console.log(`Generated ${fixture.path}`);
}
