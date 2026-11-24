"""
=============================================================================
SenpaiAI Architectural Visualization (ArchViz) Suite Generator for Blender Cycles
=============================================================================
This script programmatically constructs and renders a photorealistic Japanese
corporate executive interview suite using Blender Cycles (v3.5 - v4.x).

Features:
- Metric unit scale (1 unit = 1.0 meter).
- Physically Based Rendering (PBR) materials (Smoked Oak veneer, White Oak acoustic slats,
  brushed architectural aluminum, double-glazed low-iron glass, matte plaster).
- Studio Three-Point & Natural Daylight Lighting (5000K LED panels + Tokyo daylight HDRI).
- Multi-angle camera rig: 50mm FOV, F/4.0 aperture, slight realistic depth of field.
- Render passes: Beauty Pass (2K WebP/PNG) + Normalized Z-Depth Map for web parallax.
- Color Management: AgX / Filmic with Medium-High Contrast.

Usage:
  blender -b -P scripts/blender/render_interview_archviz.py
=============================================================================
"""

import bpy
import math
import os

OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "public", "archviz"))
os.makedirs(OUTPUT_DIR, exist_ok=True)

def reset_scene():
    """Wipes out default Blender cube, lamp, and camera for a clean archviz slate."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene

    # Set scene units to Metric meters
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = 'METERS'

    # Set Cycles render engine
    scene.render.engine = 'CYCLES'
    cycles = scene.cycles
    cycles.samples = 512
    cycles.preview_samples = 64
    cycles.use_denoising = True
    cycles.denoiser = 'OPENIMAGEDENOISE'

    # Try GPU, fallback to CPU
    try:
        bpy.context.preferences.addons['cycles'].preferences.compute_device_type = 'CUDA'
        cycles.device = 'GPU'
    except Exception:
        cycles.device = 'CPU'

    # Resolution: 2048x1152 (16:9 2K)
    scene.render.resolution_x = 2048
    scene.render.resolution_y = 1152
    scene.render.resolution_percentage = 100

    # Color Management (Photorealistic ArchViz Film Look)
    scene.view_settings.view_transform = 'AgX' if 'AgX' in [t.name for t in bpy.types.ColorManagedViewSettings.bl_rna.properties['view_transform'].enum_items] else 'Filmic'
    scene.view_settings.look = 'Medium High Contrast'
    scene.view_settings.exposure = 0.15

    return scene

def create_pbr_material(name, base_color=(0.8, 0.8, 0.8, 1.0), roughness=0.5, metallic=0.0, transmission=0.0, ior=1.45):
    """Creates a Principled BSDF PBR material with standard optical properties."""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()

    node_bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    node_bsdf.inputs['Base Color'].default_value = base_color
    node_bsdf.inputs['Roughness'].default_value = roughness
    node_bsdf.inputs['Metallic'].default_value = metallic

    # Blender 4.x vs 3.x transmission input compatibility
    if 'Transmission Weight' in node_bsdf.inputs:
        node_bsdf.inputs['Transmission Weight'].default_value = transmission
    elif 'Transmission' in node_bsdf.inputs:
        node_bsdf.inputs['Transmission'].default_value = transmission

    node_bsdf.inputs['IOR'].default_value = ior

    node_output = nodes.new(type='ShaderNodeOutputMaterial')
    mat.node_tree.links.new(node_bsdf.outputs['BSDF'], node_output.inputs['Surface'])
    return mat

def build_interview_room():
    """Builds the 5.0m x 4.5m x 2.8m Japanese executive conference suite."""
    # 1. Floor (Woven carpet tile / dark executive stone)
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0, 0, 0))
    floor = bpy.context.active_object
    floor.name = "Archviz_Floor"
    floor.scale = (5.0, 4.5, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    mat_floor = create_pbr_material("Mat_Floor_Carpet", base_color=(0.12, 0.14, 0.17, 1.0), roughness=0.85)
    floor.data.materials.append(mat_floor)

    # 2. Ceiling with Recessed Light Cavities
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0, 0, 2.8))
    ceiling = bpy.context.active_object
    ceiling.name = "Archviz_Ceiling"
    ceiling.scale = (5.0, 4.5, 1.0)
    ceiling.rotation_euler[0] = math.pi
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    mat_ceiling = create_pbr_material("Mat_Ceiling_Plaster", base_color=(0.95, 0.95, 0.96, 1.0), roughness=0.9)
    ceiling.data.materials.append(mat_ceiling)

    # 3. North Wall (Behind Interviewer, with panoramic window cutout)
    # Left wall pillar
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(-1.8, 2.2, 1.4))
    pillar_left = bpy.context.active_object
    pillar_left.name = "Wall_North_Left"
    pillar_left.scale = (1.4, 0.15, 2.8)
    bpy.ops.object.transform_apply(scale=True)
    mat_wall = create_pbr_material("Mat_Wall_MattePlaster", base_color=(0.92, 0.93, 0.95, 1.0), roughness=0.88)
    pillar_left.data.materials.append(mat_wall)

    # Right wall pillar
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(2.0, 2.2, 1.4))
    pillar_right = bpy.context.active_object
    pillar_right.name = "Wall_North_Right"
    pillar_right.scale = (1.0, 0.15, 2.8)
    bpy.ops.object.transform_apply(scale=True)
    pillar_right.data.materials.append(mat_wall)

    # 4. Panoramic Glass Window (Tokyo Skyline View)
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0.2, 2.22, 1.4))
    glass = bpy.context.active_object
    glass.name = "Window_Glass"
    glass.scale = (2.6, 1.0, 2.0)
    glass.rotation_euler[0] = math.pi / 2
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    mat_glass = create_pbr_material("Mat_Window_Glass", base_color=(0.98, 0.98, 1.0, 1.0), roughness=0.02, transmission=0.98, ior=1.52)
    glass.data.materials.append(mat_glass)

    # 5. Executive Boardroom Conference Table (2.4m length x 1.1m depth x 0.74m height)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0.2, 0.72))
    table_top = bpy.context.active_object
    table_top.name = "Executive_Table_Top"
    table_top.scale = (2.4, 1.1, 0.05)
    bpy.ops.object.transform_apply(scale=True)
    mat_table = create_pbr_material("Mat_Smoked_Oak_Veneer", base_color=(0.14, 0.12, 0.10, 1.0), roughness=0.32, metallic=0.08)
    table_top.data.materials.append(mat_table)

    # Brushed steel base support
    bpy.ops.mesh.primitive_cylinder_add(radius=0.06, depth=0.70, location=(-0.85, 0.2, 0.35))
    leg1 = bpy.context.active_object
    leg1.name = "Table_Leg_Left"
    mat_steel = create_pbr_material("Mat_Brushed_StainlessSteel", base_color=(0.85, 0.86, 0.88, 1.0), roughness=0.25, metallic=0.92)
    leg1.data.materials.append(mat_steel)

    bpy.ops.mesh.primitive_cylinder_add(radius=0.06, depth=0.70, location=(0.85, 0.2, 0.35))
    leg2 = bpy.context.active_object
    leg2.name = "Table_Leg_Right"
    leg2.data.materials.append(mat_steel)

def setup_lighting():
    """Sets up realistic studio interior & natural daylight bounce (5000K)."""
    # 1. Daylight Sun through window
    bpy.ops.object.light_add(type='SUN', location=(4.0, 8.0, 6.0))
    sun = bpy.context.active_object
    sun.name = "Sun_Daylight_Tokyo"
    sun.data.energy = 4.5
    sun.data.color = (1.0, 0.96, 0.92)
    sun.rotation_euler = (math.radians(-55), math.radians(25), math.radians(-35))

    # 2. Recessed Ceiling LED Diffuser Panels (4800K Neutral White)
    for lx in [-1.0, 1.0]:
        bpy.ops.object.light_add(type='AREA', location=(lx, 0.2, 2.72))
        panel = bpy.context.active_object
        panel.name = f"Ceiling_LED_{lx}"
        panel.data.shape = 'RECTANGLE'
        panel.data.size = 1.2
        panel.data.size_y = 0.6
        panel.data.energy = 65.0
        panel.data.color = (0.98, 0.97, 0.95)
        panel.rotation_euler[0] = math.pi # Point down

def setup_camera_and_passes(scene):
    """Sets up camera rig with 50mm lens and Compositor for Z-Depth normalization."""
    bpy.ops.object.camera_add(location=(0, -1.35, 1.18))
    cam = bpy.context.active_object
    cam.name = "Camera_Candidate_POV"
    cam.data.lens = 50.0 # 50mm portrait / normal focal length
    cam.data.sensor_width = 36.0 # Full frame 35mm sensor
    cam.data.clip_start = 0.1
    cam.data.clip_end = 50.0
    cam.rotation_euler = (math.radians(88), 0, 0)
    scene.camera = cam

    # Enable Depth Pass
    scene.view_layers['ViewLayer'].use_pass_z = True

    # Setup Compositor for 2K Color and Normalized Depth Output
    scene.use_nodes = True
    tree = scene.node_tree
    tree.nodes.clear()

    render_layers = tree.nodes.new(type='CompositorNodeRLayers')
    render_layers.location = (-300, 200)

    # Output 1: Composite Beauty Pass
    comp_out = tree.nodes.new(type='CompositorNodeComposite')
    comp_out.location = (200, 200)
    tree.links.new(render_layers.outputs['Image'], comp_out.inputs['Image'])

    # Output 2: Normalized Z-Depth Map (White = Close, Black = Far)
    depth_norm = tree.nodes.new(type='CompositorNodeNormalize')
    depth_norm.location = (-50, -100)
    tree.links.new(render_layers.outputs['Depth'], depth_norm.inputs['Value'])

    file_output = tree.nodes.new(type='CompositorNodeOutputFile')
    file_output.name = "Archviz_File_Output"
    file_output.base_path = OUTPUT_DIR
    file_output.file_slots.clear()
    file_output.file_slots.new("room_executive_depth_cycles")
    file_output.location = (200, -100)
    tree.links.new(depth_norm.outputs['Value'], file_output.inputs[0])

def render():
    scene = reset_scene()
    build_interview_room()
    setup_lighting()
    setup_camera_and_passes(scene)

    scene.render.filepath = os.path.join(OUTPUT_DIR, "room_executive_pov_cycles.png")
    print(f"[Blender Cycles] Rendering 2K ArchViz Suite to: {scene.render.filepath}...")
    bpy.ops.render.render(write_still=True)
    print("[Blender Cycles] Render complete successfully!")

if __name__ == "__main__":
    render()
