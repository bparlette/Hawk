for d in */; do s=${d%/}; ls $s/*.jpg >/dev/null 2>&1 || continue
 montage -label '%t' $(ls $s/*.jpg | grep -v contact_sheet) -auto-orient -font DejaVu-Sans -pointsize 18 -tile 4x -geometry 400x300+6+6 -background '#222' -fill white -title "$s" $s/contact_sheet.jpg 2>/dev/null
done
