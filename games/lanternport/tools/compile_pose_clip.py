#!/usr/bin/env python3
"""Compile declarative 30fps JSON pose specs (pose_specs.json) into animation-only GLB clips.

Synthesizes smooth 120Hz CMU BVH motion curves from keyframed pose specs and runs them
through Juniper's Retargeter + pose_modes + GLB writer so every output clip matches the
127-bone / 34-track contract.

Usage:
  python3 games/lanternport/tools/compile_pose_clip.py [--only pot-rampage,chest-fanfare]
"""
import argparse
import json
import math
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
LANTERNPORT_DIR = os.path.dirname(HERE)
REPO_ROOT = os.path.dirname(os.path.dirname(LANTERNPORT_DIR))
DEFAULT_TASKING = os.environ.get("TASKING_ROOT", "/Users/braidpairlette/tasking")

CMU_HIERARCHY = """HIERARCHY
ROOT Hips
{
	OFFSET 0.00000 0.00000 0.00000
	CHANNELS 6 Xposition Yposition Zposition Zrotation Yrotation Xrotation 
	JOINT LHipJoint
	{
		OFFSET 0 0 0
		CHANNELS 3 Zrotation Yrotation Xrotation
		JOINT LeftUpLeg
		{
			OFFSET 1.85590 -1.73949 0.84976
			CHANNELS 3 Zrotation Yrotation Xrotation
			JOINT LeftLeg
			{
				OFFSET 2.36836 -6.50702 0.00000
				CHANNELS 3 Zrotation Yrotation Xrotation
				JOINT LeftFoot
				{
					OFFSET 2.53268 -6.95849 0.00000
					CHANNELS 3 Zrotation Yrotation Xrotation
					JOINT LeftToeBase
					{
						OFFSET 0.15935 -0.43781 1.94506
						CHANNELS 3 Zrotation Yrotation Xrotation
						End Site
						{
							OFFSET 0.00000 -0.00000 1.00661
						}
					}
				}
			}
		}
	}
	JOINT RHipJoint
	{
		OFFSET 0 0 0
		CHANNELS 3 Zrotation Yrotation Xrotation
		JOINT RightUpLeg
		{
			OFFSET -1.68297 -1.73949 0.84976
			CHANNELS 3 Zrotation Yrotation Xrotation
			JOINT RightLeg
			{
				OFFSET -2.44709 -6.72334 0.00000
				CHANNELS 3 Zrotation Yrotation Xrotation
				JOINT RightFoot
				{
					OFFSET -2.43843 -6.69953 0.00000
					CHANNELS 3 Zrotation Yrotation Xrotation
					JOINT RightToeBase
					{
						OFFSET -0.20854 -0.57295 2.02172
						CHANNELS 3 Zrotation Yrotation Xrotation
						End Site
						{
							OFFSET -0.00000 -0.00000 1.05594
						}
					}
				}
			}
		}
	}
	JOINT LowerBack
	{
		OFFSET 0 0 0
		CHANNELS 3 Zrotation Yrotation Xrotation
		JOINT Spine
		{
			OFFSET -0.01560 2.23971 -0.03712
			CHANNELS 3 Zrotation Yrotation Xrotation
			JOINT Spine1
			{
				OFFSET 0.05490 2.19225 -0.19086
				CHANNELS 3 Zrotation Yrotation Xrotation
				JOINT Neck
				{
					OFFSET 0 0 0
					CHANNELS 3 Zrotation Yrotation Xrotation
					JOINT Neck1
					{
						OFFSET -0.12403 1.43168 0.27585
						CHANNELS 3 Zrotation Yrotation Xrotation
						JOINT Head
						{
							OFFSET 0.17855 1.46173 -0.32578
							CHANNELS 3 Zrotation Yrotation Xrotation
							End Site
							{
								OFFSET 0.07217 1.51590 -0.14537
							}
						}
					}
				}
				JOINT LeftShoulder
				{
					OFFSET 0 0 0
					CHANNELS 3 Zrotation Yrotation Xrotation
					JOINT LeftArm
					{
						OFFSET 3.27650 0.85634 0.05396
						CHANNELS 3 Zrotation Yrotation Xrotation
						JOINT LeftForeArm
						{
							OFFSET 4.96755 -0.00000 0.00000
							CHANNELS 3 Zrotation Yrotation Xrotation
							JOINT LeftHand
							{
								OFFSET 3.35751 -0.00000 0.00000
								CHANNELS 3 Zrotation Yrotation Xrotation
								JOINT LeftFingerBase
								{
									OFFSET 0 0 0
									CHANNELS 3 Zrotation Yrotation Xrotation
									JOINT LeftHandIndex1
									{
										OFFSET 0.79697 -0.00000 0.00000
										CHANNELS 3 Zrotation Yrotation Xrotation
										End Site
										{
											OFFSET 0.64254 -0.00000 0.00000
										}
									}
								}
								JOINT LThumb
								{
									OFFSET 0 0 0
									CHANNELS 3 Zrotation Yrotation Xrotation
									End Site
									{
										OFFSET 0.65235 -0.00000 0.65235
									}
								}
							}
						}
					}
				}
				JOINT RightShoulder
				{
					OFFSET 0 0 0
					CHANNELS 3 Zrotation Yrotation Xrotation
					JOINT RightArm
					{
						OFFSET -3.24434 1.02034 0.34688
						CHANNELS 3 Zrotation Yrotation Xrotation
						JOINT RightForeArm
						{
							OFFSET -5.21859 -0.00000 -0.00000
							CHANNELS 3 Zrotation Yrotation Xrotation
							JOINT RightHand
							{
								OFFSET -3.36504 -0.00000 0.00000
								CHANNELS 3 Zrotation Yrotation Xrotation
								JOINT RightFingerBase
								{
									OFFSET 0 0 0
									CHANNELS 3 Zrotation Yrotation Xrotation
									JOINT RightHandIndex1
									{
										OFFSET -0.62044 -0.00000 0.00000
										CHANNELS 3 Zrotation Yrotation Xrotation
										End Site
										{
											OFFSET -0.50022 -0.00000 0.00000
										}
									}
								}
								JOINT RThumb
								{
									OFFSET 0 0 0
									CHANNELS 3 Zrotation Yrotation Xrotation
									End Site
									{
										OFFSET -0.50786 -0.00000 0.50786
									}
								}
							}
						}
					}
				}
			}
		}
	}
}
"""


def _ensure_pipeline(tasking_root):
    if tasking_root and os.path.isdir(tasking_root) and tasking_root not in sys.path:
        sys.path.insert(0, tasking_root)
    from juniper.pipeline import bvh, glb, pose_modes, retarget, rig as rigmod, rigmath

    # Guard rigmath.qpow when looping clips produce identical boundary quaternions (xyz=0, w=1-ulp).
    _orig_qpow = rigmath.qpow

    def _safe_qpow(q, k):
        if rigmath.length(q[:3]) < rigmath.EPS:
            return rigmath.QID
        return _orig_qpow(q, k)

    rigmath.qpow = _safe_qpow
    return bvh, glb, pose_modes, retarget, rigmod, rigmath


def _vnorm(v):
    ln = math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
    return (v[0] / ln, v[1] / ln, v[2] / ln) if ln > 1e-8 else (0.0, 1.0, 0.0)


def _q_axis(rm, axis, deg):
    r = math.radians(deg) * 0.5
    ax = _vnorm(axis)
    s = math.sin(r)
    return rm.qnorm((ax[0] * s, ax[1] * s, ax[2] * s, math.cos(r)))


def _q_euler_yxz(rm, pitch_x, yaw_y, roll_z):
    qx = _q_axis(rm, (1.0, 0.0, 0.0), pitch_x)
    qy = _q_axis(rm, (0.0, 1.0, 0.0), yaw_y)
    qz = _q_axis(rm, (0.0, 0.0, 1.0), roll_z)
    return rm.qnorm(rm.qmul(qy, rm.qmul(qx, qz)))


def _mat3_from_q(rm, q):
    x, y, z, w = rm.qnorm(q)
    return (
        (1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)),
        (2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)),
        (2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)),
    )


def _q_to_zyx_deg(rm, q):
    R = _mat3_from_q(rm, q)
    sy = max(-1.0, min(1.0, -R[2][0]))
    ry = math.asin(sy)
    if abs(math.cos(ry)) > 1e-6:
        rx = math.atan2(R[2][1], R[2][2])
        rz = math.atan2(R[1][0], R[0][0])
    else:
        rx = math.atan2(-R[1][2], R[1][1])
        rz = 0.0
    return (math.degrees(rz), math.degrees(ry), math.degrees(rx))


def _flatten_keyframe(kf):
    flat = {
        "hop": float(kf.get("hop", 0.0)),
        "hx": float(kf.get("hx", 0.0)),
        "hz": float(kf.get("hz", 0.0)),
    }
    for part in ("pelvis", "spine", "head"):
        p, y, r = kf.get(part, [0.0, 0.0, 0.0])
        flat[f"{part}_p"] = float(p)
        flat[f"{part}_y"] = float(y)
        flat[f"{part}_r"] = float(r)
    for leg in ("leftLeg", "rightLeg"):
        hf, kn, ak, sp = kf.get(leg, [8.0, 12.0, -4.0, 8.0])
        flat[f"{leg}_hf"] = float(hf)
        flat[f"{leg}_kn"] = float(kn)
        flat[f"{leg}_ak"] = float(ak)
        flat[f"{leg}_sp"] = float(sp)
    for arm in ("leftArm", "rightArm"):
        pi, ab, el, fa = kf.get(arm, [12.0, 14.0, 18.0, 14.0])
        flat[f"{arm}_pi"] = float(pi)
        flat[f"{arm}_ab"] = float(ab)
        flat[f"{arm}_el"] = float(el)
        flat[f"{arm}_fa"] = float(fa)
    return flat


def _eval_keys(keys, t):
    """Monotone cubic Hermite spline interpolation over flattened scalar channels."""
    if t <= keys[0][0]:
        return dict(keys[0][1])
    if t >= keys[-1][0]:
        return dict(keys[-1][1])
    idx = 0
    while idx < len(keys) - 1 and keys[idx + 1][0] < t:
        idx += 1
    t0, k0 = keys[idx]
    t1, k1 = keys[idx + 1]
    dt = max(t1 - t0, 1e-6)
    u = (t - t0) / dt
    h00 = 2 * u * u * u - 3 * u * u + 1
    h10 = u * u * u - 2 * u * u + u
    h01 = -2 * u * u * u + 3 * u * u
    h11 = u * u * u - u * u
    out = {}
    for name, v0 in k0.items():
        v1 = k1[name]
        if idx == 0:
            m0 = 0.0
        else:
            tp, kp = keys[idx - 1]
            m0 = ((v1 - kp[name]) / max(t1 - tp, 1e-6)) * dt
        if idx + 1 == len(keys) - 1:
            m1 = 0.0
        else:
            tn, kn = keys[idx + 2]
            m1 = ((kn[name] - v0) / max(tn - t0, 1e-6)) * dt
        if idx > 0 and (v1 - v0) * (v0 - keys[idx - 1][1][name]) <= 0:
            m0 = 0.0
        if idx + 2 < len(keys) and (keys[idx + 2][1][name] - v1) * (v1 - v0) <= 0:
            m1 = 0.0
        out[name] = h00 * v0 + h10 * m0 + h01 * v1 + h11 * m1
    return out


def _build_bvh_from_spec(rm, src_bvh, src_rest, clip_spec, out_path, spec_fps=30.0):
    bvh_fps = 120.0
    n_out_frames = int(clip_spec["durationFrames"])
    dur_sec = n_out_frames / float(spec_fps)
    bvh_end_frame = int(round(dur_sec * bvh_fps))
    n_bvh_frames = bvh_end_frame + 1

    keys = sorted(
        [(float(kf["at"]) / float(spec_fps), _flatten_keyframe(kf)) for kf in clip_spec["keyframes"]],
        key=lambda x: x[0],
    )

    def bone_dir(parent_j, child_j):
        return _vnorm(rm.sub(src_rest[child_j][1], src_rest[parent_j][1]))

    rows = []
    for f in range(n_bvh_frames):
        t = min(dur_sec, f / bvh_fps)
        p = _eval_keys(keys, t)
        qw = {}
        qw["Hips"] = _q_euler_yxz(rm, p["pelvis_p"], p["pelvis_y"], p["pelvis_r"])
        qw["LHipJoint"] = qw["Hips"]
        qw["RHipJoint"] = qw["Hips"]

        qw["LowerBack"] = rm.qmul(qw["Hips"], _q_euler_yxz(rm, p["spine_p"] * 0.35, p["spine_y"] * 0.35, p["spine_r"] * 0.35))
        qw["Spine"] = rm.qmul(qw["LowerBack"], _q_euler_yxz(rm, p["spine_p"] * 0.35, p["spine_y"] * 0.35, p["spine_r"] * 0.35))
        qw["Spine1"] = rm.qmul(qw["Spine"], _q_euler_yxz(rm, p["spine_p"] * 0.30, p["spine_y"] * 0.30, p["spine_r"] * 0.30))

        qw["Neck"] = rm.qmul(qw["Spine1"], _q_euler_yxz(rm, p["head_p"] * 0.40, p["head_y"] * 0.40, p["head_r"] * 0.40))
        qw["Neck1"] = rm.qmul(qw["Neck"], _q_euler_yxz(rm, p["head_p"] * 0.30, p["head_y"] * 0.30, p["head_r"] * 0.30))
        qw["Head"] = rm.qmul(qw["Neck1"], _q_euler_yxz(rm, p["head_p"] * 0.30, p["head_y"] * 0.30, p["head_r"] * 0.30))

        foot_rel_ys = []
        for side, sgn, key_prefix in (("Left", 1.0, "leftLeg"), ("Right", -1.0, "rightLeg")):
            hf = p[f"{key_prefix}_hf"]
            kn = p[f"{key_prefix}_kn"]
            ak = p[f"{key_prefix}_ak"]
            sp = p[f"{key_prefix}_sp"]

            src_u = bone_dir(side + "UpLeg", side + "Leg")
            q_unsplay = rm.qfrom_to(src_u, (0.0, -1.0, 0.0))
            q_spread = _q_axis(rm, (0, 0, 1), sgn * sp)
            q_hip_world = rm.qmul(qw["Hips"], rm.qmul(q_spread, _q_axis(rm, (1, 0, 0), -hf)))
            qw[side + "UpLeg"] = rm.qmul(q_hip_world, q_unsplay)

            src_l = bone_dir(side + "Leg", side + "Foot")
            q_unsplay_l = rm.qfrom_to(src_l, (0.0, -1.0, 0.0))
            q_shin_world = rm.qmul(q_hip_world, _q_axis(rm, (1, 0, 0), kn))
            qw[side + "Leg"] = rm.qmul(q_shin_world, q_unsplay_l)

            q_foot_world = rm.qmul(q_shin_world, _q_axis(rm, (1, 0, 0), ak))
            qw[side + "Foot"] = q_foot_world
            qw[side + "ToeBase"] = q_foot_world

            # Measure ankle Y relative to Hips in CMU BVH units so foot rests cleanly on y=hop
            j_hip_off = src_bvh.joints[side + "UpLeg"].offset
            j_knee_off = src_bvh.joints[side + "Leg"].offset
            j_foot_off = src_bvh.joints[side + "Foot"].offset
            p_hip = rm.qrot(qw[side + "LHipJoint" if side == "Left" else "RHipJoint"] if False else qw[side[0] + "HipJoint"], j_hip_off)
            p_knee = rm.add(p_hip, rm.qrot(qw[side + "UpLeg"], j_knee_off))
            p_foot = rm.add(p_knee, rm.qrot(qw[side + "Leg"], j_foot_off))
            foot_rel_ys.append(p_foot[1])

        hy = max(-foot_rel_ys[0], -foot_rel_ys[1]) + p["hop"]

        for side, sgn, key_prefix in (("Left", 1.0, "leftArm"), ("Right", -1.0, "rightArm")):
            pi = p[f"{key_prefix}_pi"]
            ab = p[f"{key_prefix}_ab"]
            el = p[f"{key_prefix}_el"]
            fa = p[f"{key_prefix}_fa"]

            q_down = _q_axis(rm, (0, 0, 1), -sgn * (90.0 - ab))
            q_fore_down = _q_axis(rm, (0, 0, 1), -sgn * (90.0 - fa))
            q_upper_chest = rm.qmul(_q_axis(rm, (1, 0, 0), -pi), q_down)
            q_fore_chest = rm.qmul(_q_axis(rm, (1, 0, 0), -(pi + el)), q_fore_down)

            sh_role = side + "Shoulder"
            src_sh = bone_dir(sh_role, side + "Arm")
            tgt_sh = rm.qrot(qw["Spine1"], _vnorm((sgn * 0.96, 0.25, 0.0)))
            qw[sh_role] = rm.qfrom_to(src_sh, tgt_sh)
            qw[side + "Arm"] = rm.qmul(qw["Spine1"], q_upper_chest)
            qw[side + "ForeArm"] = rm.qmul(qw["Spine1"], q_fore_chest)
            qw[side + "Hand"] = qw[side + "ForeArm"]
            for suf in ("FingerBase", "HandIndex1"):
                qw[side + suf] = qw[side + "Hand"]
            qw["LThumb" if side == "Left" else "RThumb"] = qw[side + "Hand"]

        vals = []
        for jname in src_bvh.order:
            j = src_bvh.joints[jname]
            if j.parent is None:
                vals.extend([p["hx"], hy, p["hz"]])
                ql = qw[jname]
            else:
                qp = qw.get(j.parent, rm.QID)
                qd = qw.get(jname, qp)
                ql = rm.qnorm(rm.qmul(rm.qinv(qp), qd))
            rz, ry, rx = _q_to_zyx_deg(rm, ql)
            vals.extend([rz, ry, rx])
        rows.append(" ".join(f"{v:.4f}" for v in vals))

    with open(out_path, "w") as fp:
        fp.write(CMU_HIERARCHY)
        fp.write("MOTION\n")
        fp.write(f"Frames: {n_bvh_frames}\n")
        fp.write(f"Frame Time: {1.0 / bvh_fps:.7f}\n")
        for r in rows:
            fp.write(r + "\n")

    return bvh_end_frame


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--specs", default=os.path.join(HERE, "pose_specs.json"))
    ap.add_argument("--rig", default=os.path.join(LANTERNPORT_DIR, "assets/juniper/juniper_rig.glb"))
    ap.add_argument("--bonemap", default=os.path.join(HERE, "bonemap.json"))
    ap.add_argument("--out", default=os.path.join(LANTERNPORT_DIR, "assets/juniper/clips"))
    ap.add_argument("--tasking", default=DEFAULT_TASKING)
    ap.add_argument("--only", default="", help="Comma-separated clip names to compile")
    args = ap.parse_args(argv)

    bvhmod, glb, pose_modes, retarget, rigmod, rm = _ensure_pipeline(args.tasking)
    doc = json.load(open(args.specs))
    spec_fps = float(doc.get("fps", 30))
    clips = doc["clips"]
    only = set(x.strip() for x in args.only.split(",") if x.strip())
    names = [n for n in clips if not only or n in only]
    if not names:
        print(f"No matching clips in {args.specs}", file=sys.stderr)
        return 1

    bm = json.load(open(args.bonemap))
    rig = rigmod.Rig.load(args.rig)
    rt = retarget.Retargeter(rig, bm)
    helpers = {
        "RetargetError": retarget.RetargetError,
        "amplify": retarget.amplify,
        "yaw_to": retarget.yaw_to,
        "percentile": retarget.percentile,
    }
    os.makedirs(args.out, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="lanternport_poses_") as tmpdir:
        # Load hierarchy once to query joint offsets
        tmpl_bvh = os.path.join(tmpdir, "_template.bvh")
        with open(tmpl_bvh, "w") as fp:
            fp.write(CMU_HIERARCHY)
            fp.write("MOTION\nFrames: 1\nFrame Time: 0.0083333\n")
            fp.write(" ".join(["0"] * 96) + "\n")
        src_bvh = bvhmod.BVH.load(tmpl_bvh)
        src_rest = src_bvh.rest_world()

        failed = 0
        for name in names:
            sp = dict(clips[name])
            bvh_path = os.path.join(tmpdir, f"{name}.bvh")
            end_frame = _build_bvh_from_spec(rm, src_bvh, src_rest, sp, bvh_path, spec_fps=spec_fps)
            pose_cfg = {
                "source": bvh_path,
                "start_frame": 0,
                "end_frame": end_frame,
                "loop": bool(sp.get("loop", False)),
                "kind": sp.get("kind", "other"),
                "ground_mode": sp.get("ground_mode", "grounded"),
                "facing": sp.get("facing", "hips_fwd"),
                "solve_leg_ik": bool(sp.get("solve_leg_ik", True)),
                "bob_gain": float(sp.get("bob_gain", 1.0)),
                "sway_gain": float(sp.get("sway_gain", 1.0)),
                "pelvis_gain": float(sp.get("pelvis_gain", 1.0)),
                "trunk_gain": float(sp.get("trunk_gain", 1.0)),
                "remove_drift": bool(sp.get("remove_drift", False)),
                "seam_blend": float(sp.get("seam_blend", 0.2 if sp.get("loop", False) else 0.0)),
            }
            if "knee_flip_tol_deg" in sp:
                pose_cfg["knee_flip_tol_deg"] = sp["knee_flip_tol_deg"]
            try:
                entry, times, tracks = pose_modes.run_pose(rt, bvh_path, name, pose_cfg, helpers)
                entry["source"] = f"{name}.pose_spec.json"
                out_glb = os.path.join(args.out, entry["file"])
                glb.write_animation_glb(
                    out_glb,
                    rig.js,
                    rig.skeleton_indices(),
                    name,
                    times,
                    tracks,
                    extras={k: entry[k] for k in ("kind", "fps", "frames", "speed", "source")},
                )
                q = entry["quality"]
                print(
                    "ok    %-20s %3d frames  loop=%-5s tracks=%2d  minToe=%+.2f  knee=(%.0f..%.0f)"
                    % (
                        name,
                        entry["frames"],
                        entry["loop"],
                        len(tracks),
                        q["min_toe_clearance"],
                        q["min_knee_bend_deg"],
                        q["max_knee_bend_deg"],
                    )
                )
            except Exception as exc:
                failed += 1
                print(f"FAIL  {name}: {exc}", file=sys.stderr)
        return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
